import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { Workflow } from '../entities/Workflow/index.mjs';
import { assertWorkflowSchema } from '../file-contracts/workflow-document-schema.mjs';
import { validateWorkflowFile } from './helpers/orbita-production-api.mjs';
import { assertOutputSchemaIfDeclared } from '../runtime/output/worker-output.mjs';
import { artifactPathBoundaryErrors } from '../persistence/workflow-resources/artifact-path-boundaries.mjs';
import { acceptedOutputHistoryDetails } from '../runner/history-projection.mjs';
import { loadOutputSchema } from '../persistence/workflow-resources/output-schema-loader.mjs';
import { loadWorkflowRuntime } from '../persistence/workflow-resources/runtime-reader.mjs';
import { readRunArtifactContent } from '../persistence/workflow-resources/runtime-reader.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'orbita-cycle4-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

function writeJson(pathname, value) {
  mkdirSync(path.dirname(pathname), { recursive: true });
  writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`);
}

function workflowWithStepId(stepId) {
  return {
    name: 'step-id-parity',
    version: 1,
    start: stepId,
    done: 'done',
    steps: {
      [stepId]: { name: 'Work', kind: 'worker', output: { template: 'output.md' }, next: 'done' },
      done: { name: 'Done', kind: 'done' },
    },
  };
}

test('workflow step IDs share runner-storage validation across schema and semantic API', () => {
  for (const stepId of ['bad/id', 'bad id', 'шаг', '.', '..']) {
    const doc = workflowWithStepId(stepId);
    assert.throws(() => assertWorkflowSchema(doc), /workflow failed schema validation/);
    assert.throws(() => new Workflow(doc).validate({ requireSchemaPresence: false }), /invalid for runner storage/);

    const workflowPath = path.join(tempDir, `invalid-${Buffer.from(stepId).toString('hex')}.workflow.json`);
    writeJson(workflowPath, doc);
    assert.throws(() => validateWorkflowFile(workflowPath), /workflow failed schema validation/);
  }

  const allowed = workflowWithStepId('review.step-2_ok');
  assert.doesNotThrow(() => assertWorkflowSchema(allowed));
  assert.equal(new Workflow(allowed).validate({ requireSchemaPresence: false }).ok, true);
});

const validWorkerSchema = {
  type: 'object',
  required: ['outcome'],
  properties: { outcome: { type: 'string' } },
};
const invalidWorkerSchema = {
  type: 'object',
  required: ['outcome'],
  properties: { outcome: { type: 'number' } },
};

test('shard workers and fanout branches resolve explicit qualified producer schema keys before refs or owner aliases', () => {
  const shard = {
    name: 'qualified-shard-schema', version: 1, start: 'split', done: 'done',
    steps: {
      split: {
        name: 'Split', kind: 'shard', input: { shards: ['a'] }, output: { template: 'output.md' },
        worker: { input: { prompt: 'work' }, output: { template: 'output.md', schema: 'shared.json' } }, next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  };
  assert.equal(new Workflow(shard).validate({
    outputSchemas: new Map([
      ['split', invalidWorkerSchema],
      ['split.worker', validWorkerSchema],
      ['shared.json', invalidWorkerSchema],
    ]),
  }).ok, true);

  const fanout = {
    name: 'qualified-fanout-schema', version: 1, start: 'review', done: 'done',
    steps: {
      review: {
        name: 'Review', kind: 'fanout', input: { branches: ['qa'] }, output: { template: 'output.md' },
        branches: { qa: { input: { prompt: 'review' }, output: { template: 'output.md', schema: 'shared.json' } } }, next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  };
  assert.equal(new Workflow(fanout).validate({
    outputSchemas: new Map([
      ['qa', invalidWorkerSchema],
      ['review.branches.qa', validWorkerSchema],
      ['shared.json', invalidWorkerSchema],
    ]),
  }).ok, true);

  assert.doesNotThrow(() => assertOutputSchemaIfDeclared({
    baton: { state: { attempts: {} } },
    stepId: 'generated-request-id',
    producerKey: 'split.worker',
    step: { kind: 'worker', output: { schema: 'shared.json' } },
    workerOutput: { outcome: 'ready' },
    resources: { outputSchemas: new Map([['split.worker', validWorkerSchema], ['shared.json', invalidWorkerSchema]]) },
  }));
});

test('artifact and debug-summary boundaries reject ancestor symlink escapes from the canonical run directory', async () => {
  const runDir = path.join(tempDir, 'symlink-run');
  const outside = path.join(tempDir, 'symlink-outside');
  mkdirSync(runDir, { recursive: true });
  mkdirSync(path.join(outside, 'artifacts'), { recursive: true });
  writeFileSync(path.join(outside, 'debug-summary.md'), 'outside secret\n');
  symlinkSync(outside, path.join(runDir, 'worker'), 'dir');

  const artifactOutputDir = path.join(runDir, 'worker', 'artifacts');
  const artifactPath = path.join(artifactOutputDir, 'packet.md');
  assert.match(artifactPathBoundaryErrors({ artifacts: [{ path: artifactPath }] }, artifactOutputDir, runDir).join('\n'), /canonical run directory|symlinks/);

  await assert.rejects(
    () => acceptedOutputHistoryDetails({
      stepId: 'worker',
      request: { action: 'run_worker' },
      output: { outcome: 'ready' },
      debugSummaryPath: path.join(runDir, 'worker', 'debug-summary.md'),
      runDir,
    }),
    /debug summary file is required but unavailable \(EBOUNDARY\)/,
  );
});

test('artifact reads fail closed when a previously safe ancestor is swapped to an outside symlink', () => {
  const runDir = path.join(tempDir, 'artifact-swap-run');
  const workerDir = path.join(runDir, 'worker');
  const artifactOutputDir = path.join(workerDir, 'artifacts');
  const artifactPath = path.join(artifactOutputDir, 'packet.md');
  const outside = path.join(tempDir, 'artifact-swap-outside');
  mkdirSync(artifactOutputDir, { recursive: true });
  mkdirSync(path.join(outside, 'artifacts'), { recursive: true });
  writeFileSync(artifactPath, 'safe body\n');
  writeFileSync(path.join(outside, 'artifacts', 'packet.md'), 'outside secret\n');

  assert.deepEqual(artifactPathBoundaryErrors({ artifacts: [{ path: artifactPath }] }, artifactOutputDir, runDir), []);
  renameSync(workerDir, path.join(runDir, 'worker-original'));
  symlinkSync(outside, workerDir, 'dir');

  assert.throws(
    () => readRunArtifactContent({ runDir, artifactPath }),
    /artifact path cannot escape run directory via symlink/,
  );
});

test('schema and compiled-runtime caches invalidate on same-size preserved-mtime writes and atomic rotation', () => {
  const packageRoot = path.join(tempDir, 'cache-package');
  const workflowPath = path.join(packageRoot, 'workflow.json');
  const schemaPath = path.join(packageRoot, 'output.schema.json');
  mkdirSync(path.join(packageRoot, 'roles'), { recursive: true });
  writeFileSync(path.join(packageRoot, 'output.md'), 'Return JSON.\n');
  const schemaA = '{"type":"object","required":["outcome"],"properties":{"outcome":{"const":"A"}}}';
  const schemaB = '{"type":"object","required":["outcome"],"properties":{"outcome":{"const":"B"}}}';
  assert.equal(schemaA.length, schemaB.length);
  writeFileSync(schemaPath, schemaA);
  const doc = workflowWithStepId('worker');
  doc.steps.worker.output.schema = 'output.schema.json';
  writeJson(workflowPath, doc);

  assert.equal(loadOutputSchema({ workflow: doc, workflowPath, schemaRef: 'output.schema.json', repositoryRoot: packageRoot }).schema.properties.outcome.const, 'A');
  const originalTimes = statSync(schemaPath);
  writeFileSync(schemaPath, schemaB);
  utimesSync(schemaPath, originalTimes.atime, originalTimes.mtime);
  assert.equal(loadOutputSchema({ workflow: doc, workflowPath, schemaRef: 'output.schema.json', repositoryRoot: packageRoot }).schema.properties.outcome.const, 'B');

  const rotated = path.join(packageRoot, 'rotated.schema.json');
  writeFileSync(rotated, schemaA);
  utimesSync(rotated, originalTimes.atime, originalTimes.mtime);
  renameSync(rotated, schemaPath);
  assert.equal(loadOutputSchema({ workflow: doc, workflowPath, schemaRef: 'output.schema.json', repositoryRoot: packageRoot }).schema.properties.outcome.const, 'A');

  const baton = { cursor: 'worker', status: 'running', state: { artifacts: [], results: [] } };
  const firstRuntime = loadWorkflowRuntime({ workflowPath, baton });
  assert.equal(firstRuntime.workflow.steps.worker.name, 'Work');
  const workflowTimes = statSync(workflowPath);
  const changed = structuredClone(doc);
  changed.steps.worker.name = 'Task';
  const before = JSON.stringify(doc, null, 2);
  const after = JSON.stringify(changed, null, 2);
  assert.equal(before.length, after.length);
  writeFileSync(workflowPath, `${after}\n`);
  utimesSync(workflowPath, workflowTimes.atime, workflowTimes.mtime);
  const secondRuntime = loadWorkflowRuntime({ workflowPath, baton });
  assert.equal(secondRuntime.workflow.steps.worker.name, 'Task');
});
