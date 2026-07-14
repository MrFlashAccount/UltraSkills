import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { claimWorkflowRunForTest } from './helpers/workflow-runner-api-client.mjs';
import { continueRun, loadInstructions, next, writeOutput } from './helpers/orbita-production-api.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';

const root = mkdtempSync(path.join(tmpdir(), 'workflow-artifact-provenance-'));
const runsRoot = path.join(root, 'runs');
const leaseTokens = new Map();
writeFileSync(path.join(root, 'output.md'), 'Return strict JSON.\n');
afterAll(() => rmSync(root, { recursive: true, force: true }));

function writeJson(pathname, value) {
  writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`);
}

function artifactSchema(label) {
  const pathname = path.join(root, `${label}.schema.json`);
  writeJson(pathname, {
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { type: 'string' },
      artifacts: {
        type: 'array',
        items: { $ref: 'https://github.com/MrFlashAccount/Skills/schemas/workflow/baton#/$defs/artifact' },
      },
    },
    additionalProperties: false,
  });
  return path.basename(pathname);
}

async function startRun(label, workflow) {
  const workflowPath = path.join(root, `${label}.workflow.json`);
  writeJson(workflowPath, workflow);
  const runId = `${label}-${process.pid}`;
  const paths = resolveRunPaths({ runId, workflowPath, runsRoot });
  const leaseToken = await claimWorkflowRunForTest(paths, {
    leaseTokensByRunId: leaseTokens,
    testLeaseToken: `${label}-token`,
  });
  const response = await next({ runId, workflowPath, runsRoot, leaseToken });
  return { leaseToken, paths, response, runId, runsRoot, workflowPath };
}

function debugSummary(paths, stepId) {
  const pathname = path.join(paths.runDir, stepId, 'debug-summary.md');
  mkdirSync(path.dirname(pathname), { recursive: true });
  writeFileSync(pathname, `debug summary for ${stepId}\n`);
  return pathname;
}

async function acceptArtifact(run, stepId, artifactDir) {
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, 'packet.md');
  writeFileSync(artifactPath, '# packet\n');
  await writeOutput({
    ...run,
    stepId,
    debugSummaryFile: debugSummary(run.paths, stepId),
    json: JSON.stringify({
      outcome: 'ready',
      artifacts: [{ id: 'packet', content_type: 'text/markdown', path: artifactPath }],
    }),
  });
}

test('routed second-step instructions and acceptance use the applied owner occurrence', async () => {
  const schema = artifactSchema('routed');
  const run = await startRun('routed-artifact', {
    name: 'routed-artifact', version: 1, start: 'prepare', done: 'done',
    steps: {
      prepare: { name: 'Prepare', kind: 'worker', input: { prompt: 'Prepare.' }, output: { template: 'output.md' }, next: 'implementation' },
      implementation: { name: 'Implement', kind: 'worker', input: { prompt: 'Implement.' }, output: { template: 'output.md', schema }, next: 'done' },
      done: { name: 'Done', kind: 'done' },
    },
  });
  await writeOutput({
    ...run,
    stepId: 'prepare',
    debugSummaryFile: debugSummary(run.paths, 'prepare'),
    json: JSON.stringify({ outcome: 'ready' }),
  });
  await continueRun(run);
  const artifactDir = path.join(run.paths.runDir, 'implementation', 'occurrences', '1', 'requests', 'implementation', 'artifacts');
  assert.match(await loadInstructions({ ...run, stepId: 'implementation' }), new RegExp(artifactDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await acceptArtifact(run, 'implementation', artifactDir);
  await continueRun(run);
  const baton = JSON.parse(readFileSync(run.paths.batonPath, 'utf8'));
  assert.deepEqual(baton.state.artifacts.map((entry) => [entry.producerStepId, entry.producerOccurrence, entry.producerRequestId]), [['implementation', 1, 'implementation']]);
});

function parallelWorkflow(kind, schema) {
  const owner = kind === 'fanout'
    ? {
        name: 'Parallel', kind: 'fanout', max_parallel: 1,
        input: { branches: ['branch_a'], prompt: 'Finish.' },
        output: { template: 'output.md', schema },
        branches: { branch_a: { input: { prompt: 'Branch.' }, output: { template: 'output.md', schema } } },
        next: 'done',
      }
    : {
        name: 'Parallel', kind: 'shard', max_parallel: 1,
        input: { shards: ['alpha'], prompt: 'Finish.' },
        output: { template: 'output.md', schema },
        worker: { input: { prompt: 'Shard ${{ shard.index }}.' }, output: { template: 'output.md', schema } },
        next: 'done',
      };
  return { name: `${kind}-artifact`, version: 1, start: 'parallel', done: 'done', steps: { parallel: owner, done: { name: 'Done', kind: 'done' } } };
}

for (const kind of ['fanout', 'shard']) {
  test(`${kind} instructions and acceptance stay inside the owner occurrence`, async () => {
    const run = await startRun(`${kind}-artifact`, parallelWorkflow(kind, artifactSchema(kind)));
    const requestId = run.response.requests[0].stepId;
    const artifactDir = path.join(run.paths.runDir, 'parallel', 'occurrences', '1', 'requests', requestId, 'artifacts');
    assert.match(await loadInstructions({ ...run, stepId: requestId }), new RegExp(artifactDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await acceptArtifact(run, requestId, artifactDir);
    const baton = JSON.parse(readFileSync(run.paths.batonPath, 'utf8'));
    const pending = baton.state.$occurrenceProvenance.pendingArtifactAcceptances[requestId];
    assert.equal(pending.ownerStepId, 'parallel');
    assert.equal(pending.ownerOccurrence, 1);
    assert.equal(pending.producerRequestId, requestId);
    assert.equal(pending.artifacts[0].id, 'packet');
  });
}
