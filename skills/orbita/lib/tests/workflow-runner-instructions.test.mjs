import assert from 'node:assert/strict';
import { claimWorkflowRunForTest, runWorkflowRunnerApi } from './helpers/workflow-runner-api-client.mjs';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { continueRun as runnerContinueRun, loadInstructions as runnerLoadInstructions, next as runnerNext, writeOutput as runnerWriteOutput } from './helpers/orbita-production-api.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { claimWorkflowRunAtRoot } from '../persistence/run-state/workflow-runs.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-runner-check-'));
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn markdown.\n');
const testLeaseToken = `workflow-runner-test-token-${process.pid}`;
const leaseTokensByRunId = new Map();
process.env.WORKFLOW_RUN_TOKEN = testLeaseToken;

const workflowDoc = {
    name: 'runner-check',
    version: 1,
    start: 'prepare',
    done: 'done',
    steps: {
      prepare: {
        name: 'Prepare',
        kind: 'worker',
        input: { prompt: 'Prepare branch.' },
        output: { template: 'output.md' },
        next: 'branch_a',
      },
      branch_a: {
        name: 'Branch A',
        kind: 'worker',
        input: { prompt: 'Run branch A.' },
        output: { template: 'output.md' },
        next: 'branch_b',
      },
      branch_b: {
        name: 'Branch B',
        kind: 'worker',
        input: { prompt: 'Run branch B.' },
        output: { template: 'output.md' },
        next: 'join',
      },
      join: {
        name: 'Join',
        kind: 'worker',
        input: { prompt: 'Join branch output.' },
        output: { template: 'output.md' },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
    },

};

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function debugSummaryFileFor({ runId, stepId, runsRoot, text = 'worker debug summary\n' }) {
  const debugSummaryFile = path.join(resolveRunPaths({ runId, runsRoot }).runDir, stepId, 'debug-summary.md');
  mkdirSync(path.dirname(debugSummaryFile), { recursive: true });
  writeFileSync(debugSummaryFile, text);
  return debugSummaryFile;
}

async function claimRunForTest(paths) {
  return await claimWorkflowRunForTest(paths, { leaseTokensByRunId, testLeaseToken });
}

async function runCase(label, workflowPath) {
  const runId = `workflow-runner-test-${process.pid}-${label}`;
  const paths = resolveRunPaths({ runId, workflowPath });
  rmSync(paths.runDir, { recursive: true, force: true });
  if (workflowPath !== undefined) await claimRunForTest(paths);
  return { runId, runDir: paths.runDir };
}

function valueAfter(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function claimRunForRunnerArgs(args) {
  const runId = valueAfter(args, '--run-id');
  if (!runId) return undefined;
  const workflowPath = valueAfter(args, '--workflow');
  const knownToken = leaseTokensByRunId.get(runId);
  if (knownToken) return knownToken;
  const paths = resolveRunPaths({ runId, workflowPath });
  return await claimRunForTest(paths);
}

function withLeaseTokenArg(args, token) {
  if (args.includes('--lease-token') || !token) return args;
  const [mode, ...rest] = args;
  return [mode, `--lease-token=${token}`, ...rest];
}

function withDebugSummaryArg(args, options = {}) {
  if (args[0] !== 'write-output' || args.includes('--debug-summary-file') || options.debugSummary !== true) return args;
  const runId = valueAfter(args, '--run-id');
  const stepId = valueAfter(args, '--step-id');
  if (!runId || !stepId) return args;
  const runsRoot = valueAfter(args, '--runs-root');
  const debugSummaryPath = path.join(resolveRunPaths({ runId, runsRoot }).runDir, stepId, 'debug-summary.md');
  mkdirSync(path.dirname(debugSummaryPath), { recursive: true });
  writeFileSync(debugSummaryPath, options.debugSummaryText ?? `debug summary for ${stepId}\n`);
  return [...args, '--debug-summary-file', debugSummaryPath];
}

async function runRunner(args, options = {}) {
  const token = await claimRunForRunnerArgs(args);
  const runnerArgs = withDebugSummaryArg(withLeaseTokenArg(args, token), options);
  return runWorkflowRunnerApi(runnerArgs, { ...options, env: { WORKFLOW_RUN_TOKEN: token ?? testLeaseToken, ...(options.env ?? {}) } });
}

async function waitForPath(filePath) {
  const startedAt = Date.now();
  while (!existsSync(filePath)) {
    if (Date.now() - startedAt > 2000) throw new Error(`timed out waiting for ${filePath}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function expectRunner(args, label, options = {}) {
  const result = await runRunner(args, options);
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function workerOutput(summary) {
  return { outcome: 'ready', results: [{ type: 'check', summary }] };
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

test('runner: next resolves external workflow package shared resources from repo boundary', async () => {
  const repoDir = path.join(tempDir, 'external-runner-shared-repo');
  const workflowDir = path.join(repoDir, 'workflows', 'demo');
  const sharedDir = path.join(repoDir, 'shared');
  mkdirSync(workflowDir, { recursive: true });
  mkdirSync(sharedDir, { recursive: true });
  writeFileSync(path.join(workflowDir, 'output.md'), '## Output contract\nReturn markdown.\n');
  writeFileSync(path.join(sharedDir, 'shared.schema.json'), JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: { outcome: { const: 'ready' } },
    additionalProperties: false,
  }));
  const doc = structuredClone(workflowDoc);
  doc.steps.prepare.next = 'done';
  doc.steps.prepare.output = { template: 'output.md', schema: '../../shared/shared.schema.json' };
  writeJson(path.join(workflowDir, 'workflow.json'), doc);

  const { runId } = await runCase('external-runner-shared-run');
  const result = await runRunner(['next', '--run-id', runId, '--workflow', path.join(workflowDir, 'workflow.json')]);

  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.requests[0].stepId, 'prepare');
});

test('runner: claimed harness selects fresh-subagent model guidance without polluting worker instructions', async () => {
  const workflowPath = path.join(tempDir, 'worker-runtime-guidance-workflow.json');
  const configuredWorkflow = structuredClone(workflowDoc);
  configuredWorkflow.steps.prepare.agent = 'architect';
  configuredWorkflow.steps.prepare.agent_runtime = {
    codex: { model: 'gpt-5.5', thinking_level: 'high' },
    portable: { model: 'portable-model', thinking_level: 'extended' },
  };
  configuredWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, configuredWorkflow);

  const { runId } = await runCase('worker-runtime-guidance', workflowPath);
  const paths = resolveRunPaths({ runId, workflowPath });
  const leaseToken = leaseTokensByRunId.get(runId);
  const claim = await claimWorkflowRunAtRoot({
    runId,
    workflowPath,
    runsRoot: paths.runsRoot,
    leaseToken,
    harness: 'CoDeX',
  });
  assert.equal(claim.ok, true);

  const response = await runnerNext({ runId, workflowPath, leaseToken });
  assert.deepEqual(response.requests[0].agentRuntime, { model: 'gpt-5.5', thinkingLevel: 'high' });
  assert.match(response.orchestratorInstruction, /Recommended for a fresh subagent when available: model gpt-5\.5 with thinking level high; otherwise use the harness default\./);

  const instructions = await runnerLoadInstructions({ runId, workflowPath, stepId: 'prepare', leaseToken });
  assert.doesNotMatch(instructions, /fresh subagent|thinking level high/);
});

test('runner: unknown claimed harness omits model guidance', async () => {
  const workflowPath = path.join(tempDir, 'worker-runtime-guidance-unknown-workflow.json');
  const configuredWorkflow = structuredClone(workflowDoc);
  configuredWorkflow.steps.prepare.agent = 'architect';
  configuredWorkflow.steps.prepare.agent_runtime = { codex: { model: 'gpt-5.5', thinking_level: 'high' } };
  configuredWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, configuredWorkflow);

  const { runId } = await runCase('worker-runtime-guidance-unknown', workflowPath);
  const paths = resolveRunPaths({ runId, workflowPath });
  const leaseToken = leaseTokensByRunId.get(runId);
  await claimWorkflowRunAtRoot({ runId, workflowPath, runsRoot: paths.runsRoot, leaseToken, harness: 'portable' });

  const response = await runnerNext({ runId, workflowPath, leaseToken });
  assert.equal(Object.hasOwn(response.requests[0], 'agentRuntime'), false);
  assert.doesNotMatch(response.orchestratorInstruction, /Recommended for a fresh subagent/);
});

test('runner: agent runtime configuration without an explicit source agent is rejected', async () => {
  const workflowPath = path.join(tempDir, 'worker-runtime-guidance-no-agent-workflow.json');
  const configuredWorkflow = structuredClone(workflowDoc);
  configuredWorkflow.steps.prepare.agent_runtime = { codex: { model: 'gpt-5.5', thinking_level: 'high' } };
  configuredWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, configuredWorkflow);

  const { runId } = await runCase('worker-runtime-guidance-no-agent', workflowPath);
  const paths = resolveRunPaths({ runId, workflowPath });
  const leaseToken = leaseTokensByRunId.get(runId);
  await claimWorkflowRunAtRoot({ runId, workflowPath, runsRoot: paths.runsRoot, leaseToken, harness: 'codex' });

  await assert.rejects(
    () => runnerNext({ runId, workflowPath, leaseToken }),
    /agent_runtime.*agent|agent.*required/i,
  );
});

test('runner: resume schema validation rejects case-folded duplicate agent runtime harnesses after workflow drift', async () => {
  const workflowPath = path.join(tempDir, 'worker-runtime-guidance-duplicate-resume-workflow.json');
  const configuredWorkflow = structuredClone(workflowDoc);
  configuredWorkflow.steps.prepare.agent = 'architect';
  configuredWorkflow.steps.prepare.agent_runtime = { codex: { model: 'gpt-5.5', thinking_level: 'high' } };
  configuredWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, configuredWorkflow);

  const { runId } = await runCase('worker-runtime-guidance-duplicate-resume', workflowPath);
  const paths = resolveRunPaths({ runId, workflowPath });
  const leaseToken = leaseTokensByRunId.get(runId);
  await claimWorkflowRunAtRoot({ runId, workflowPath, runsRoot: paths.runsRoot, leaseToken, harness: 'codex' });
  await runnerNext({ runId, workflowPath, leaseToken });

  configuredWorkflow.steps.prepare.agent_runtime.Codex = { model: 'gpt-5.5-mini', thinking_level: 'low' };
  writeJson(workflowPath, configuredWorkflow);

  await assert.rejects(
    () => runnerNext({ runId, workflowPath, leaseToken }),
    /agent_runtime harness keys 'codex' and 'Codex' differ only by ASCII case/,
  );
});

test('runner: next uses semantic workflow validation and rejects schema-declared dynamic targets that are not workflow steps', async () => {
  const { runId, runDir } = await runCase('runtime-semantic-dynamic-target');
  const workflowPath = path.join(tempDir, 'runtime-semantic-dynamic-target-workflow.json');
  const schemaPath = path.join(tempDir, 'runtime-semantic-dynamic-target.schema.json');
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'route'],
    properties: {
      outcome: { enum: ['ready', 'blocked'] },
      route: { enum: ['done', 'missing_step'] },
    },
    additionalProperties: false,
  });
  const dynamicWorkflow = structuredClone(workflowDoc);
  dynamicWorkflow.steps.prepare.output = { template: 'output.md', schema: path.basename(schemaPath) };
  dynamicWorkflow.steps.prepare.next = '${{ output.route }}';
  writeJson(workflowPath, dynamicWorkflow);

  const result = await runRunner(['next', '--run-id', runId, '--workflow', workflowPath]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /prepare.*next expression.*missing_step/);
});

test('runner: continue rejects explicit workflow mismatch with indexed workflow context', async () => {
  const { runId, runDir } = await runCase('continue-workflow-mismatch');
  const workflowPath = path.join(tempDir, 'continue-workflow-mismatch-a.json');
  const otherWorkflowPath = path.join(tempDir, 'continue-workflow-mismatch-b.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);
  writeJson(otherWorkflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next workflow mismatch setup');

  const mismatched = await runRunner(['continue', '--run-id', runId, '--workflow', otherWorkflowPath]);

  assert.notEqual(mismatched.status, 0);
  assert.match(mismatched.stderr, /already bound to a different workflow/);
  assert.equal(JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8')).cursor, 'prepare');
});

test('runner: instructions rejects explicit workflow mismatch with indexed workflow context', async () => {
  const { runId, runDir } = await runCase('instructions-workflow-mismatch');
  const workflowPath = path.join(tempDir, 'instructions-workflow-mismatch-a.json');
  const otherWorkflowPath = path.join(tempDir, 'instructions-workflow-mismatch-b.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);
  writeJson(otherWorkflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next instructions workflow mismatch setup');

  const mismatched = await runRunner(['instructions', '--run-id', runId, '--workflow', otherWorkflowPath, '--step-id', 'prepare']);

  assert.notEqual(mismatched.status, 0);
  assert.match(mismatched.stderr, /already bound to a different workflow/);
});

test('runner: continue rejects when recomputed current response is terminal', async () => {
  const { runId, runDir } = await runCase('continue-terminal-current-response');
  const workflowPath = path.join(tempDir, 'continue-terminal-current-response-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next stale continue setup');
  writeJson(path.join(runDir, 'baton.json'), { cursor: 'done', status: 'done', state: { artifacts: [], results: [], prepare: workerOutput('prepared elsewhere') } });

  const stale = await runRunner(['continue', '--run-id', runId, '--workflow', workflowPath]);

  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /current runner response is 'done', not needs_host_actions/);
  assert.equal(JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8')).cursor, 'done');
});

test('runner: instructions rejects request that is not in recomputed current response', async () => {
  const { runId, runDir } = await runCase('instructions-not-current-request');
  const workflowPath = path.join(tempDir, 'instructions-not-current-request-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next stale instructions setup');
  writeJson(path.join(runDir, 'baton.json'), { cursor: 'done', status: 'done', state: { artifacts: [], results: [], prepare: workerOutput('prepared') } });

  const stale = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);

  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /stale workflow-runner command from an older response/);
  assert.match(stale.stderr, /requested step 'prepare'/);
  assert.match(stale.stderr, /current request step ids: none/);
  assert.match(stale.stderr, /Use the latest workflow-runner response\/instructions/);
});

test('runner: stale older-response commands name the current request step ids', async () => {
  const { runId } = await runCase('stale-current-request-diagnostics');
  const workflowPath = path.join(tempDir, 'stale-current-request-diagnostics-workflow.json');
  writeJson(workflowPath, workflowDoc);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next stale current request diagnostics');
  await expectRunner(['write-output', '--run-id', runId, '--step-id', 'prepare'], 'write prepare before stale diagnostics', { input: JSON.stringify(workerOutput('prepared')), debugSummary: true });
  let continued = await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], 'continue to branch fanout');
  assert.deepEqual(continued.requests.map((request) => request.stepId), ['branch_a']);

  await expectRunner(['write-output', '--run-id', runId, '--step-id', 'branch_a'], 'write branch_a before stale diagnostics', { input: JSON.stringify(workerOutput('branch a')), debugSummary: true });
  continued = await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], 'continue to branch b');
  assert.deepEqual(continued.requests.map((request) => request.stepId), ['branch_b']);
  await expectRunner(['write-output', '--run-id', runId, '--step-id', 'branch_b'], 'write branch_b before stale diagnostics', { input: JSON.stringify(workerOutput('branch b')), debugSummary: true });
  continued = await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], 'continue to join request');
  assert.deepEqual(continued.requests.map((request) => request.stepId), ['join']);

  const staleInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'branch_a']);
  assert.notEqual(staleInstructions.status, 0);
  assert.match(staleInstructions.stderr, /stale workflow-runner command from an older response/);
  assert.match(staleInstructions.stderr, /requested step 'branch_a'/);
  assert.match(staleInstructions.stderr, /current request step ids: join/);
  assert.match(staleInstructions.stderr, /Use the latest workflow-runner response\/instructions/);

});

test('runner: instructions rejects unknown and unsafe step ids, and recomputes missing prompt files', async () => {
  const { runId, runDir } = await runCase('instructions-errors');
  const workflowPath = path.join(tempDir, 'instructions-errors-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next instructions errors');

  const unknown = await runRunner(['instructions', '--run-id', runId, '--step-id', 'nope']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /stale workflow-runner command from an older response/);
  assert.match(unknown.stderr, /requested step 'nope'/);
  assert.match(unknown.stderr, /current request step ids: prepare/);

  const unsafe = await runRunner(['instructions', '--run-id', runId, '--step-id', '../prepare']);
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /invalid workflow step id/);

  rmSync(path.join(runDir, '.workflow-runner', 'instructions', 'prepare.md'), { force: true });
  const recomputed = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);
  assert.equal(recomputed.status, 0, recomputed.stderr);
  assert.match(recomputed.stdout, /# Prepare/);
  assert.equal(existsSync(path.join(runDir, '.workflow-runner', 'instructions', 'prepare.md')), false);
});

test('runner: rendered artifact instructions include the absolute step artifact directory', async () => {
  const { runId, runDir } = await runCase('artifact-output-dir');
  const workflowPath = path.join(tempDir, 'artifact-output-dir-workflow.json');
  const schemaPath = path.join(tempDir, 'artifact-output-dir-output.schema.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.output = { template: 'output.md', schema: path.basename(schemaPath) };
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(schemaPath, {
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { type: 'string' },
      artifacts: {
        type: 'array',
        items: { $ref: 'https://github.com/MrFlashAccount/Skills/schemas/workflow/baton#/$defs/artifact' },
      },
    },
  });
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next artifact output dir');
  const loaded = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);
  assert.equal(loaded.status, 0, loaded.stderr);
  const instructions = loaded.stdout;

  assert.match(instructions, new RegExp(`Artifact output directory for this step: ${path.join(runDir, 'prepare', 'artifacts').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(instructions, /Use the artifact id as the artifact file name\/stem/);
  assert.match(instructions, /artifacts\[\]\.path to the full absolute filesystem path/);
  assert.match(instructions, /Do not create a separate JSON output file and do not pass an output path to the orchestrator/);
});

function artifactOutputWorkflow(label) {
  const workflowPath = path.join(tempDir, `${label}-workflow.json`);
  const schemaPath = path.join(tempDir, `${label}-output.schema.json`);
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.output = { template: 'output.md', schema: path.basename(schemaPath) };
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(schemaPath, {
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { type: 'string' },
      artifacts: {
        type: 'array',
        items: { $ref: 'https://github.com/MrFlashAccount/Skills/schemas/workflow/baton#/$defs/artifact' },
      },
    },
  });
  writeJson(workflowPath, singleWorkflow);
  return workflowPath;
}

async function startArtifactOutputRun(label) {
  const { runId, runDir } = await runCase(label);
  const workflowPath = artifactOutputWorkflow(label);
  const leaseToken = `${label}-token-${process.pid}`;
  await runnerNext({ runId, workflowPath, leaseToken });
  return { runId, runDir, workflowPath, leaseToken, artifactDir: path.join(runDir, 'prepare', 'artifacts') };
}

test('runner write-output rejects relative artifact paths', async () => {
  const { runId, workflowPath, leaseToken } = await startArtifactOutputRun('relative-artifact-path-reject');

  await assert.rejects(
    () => runnerWriteOutput({
      runId,
      workflowPath,
      stepId: 'prepare',
      json: JSON.stringify({ outcome: 'ready', artifacts: [{ id: 'plan', content_type: 'text/markdown', path: 'plan/artifacts/plan.md' }] }),
      leaseToken,
    }),
    /output schema validation failed for step 'prepare'.*artifacts\/0\/path/s,
  );
});

test('runner write-output validates artifact boundaries without declared output schema', async () => {
  const { runId } = await runCase('schemaless-artifact-path-reject');
  const workflowPath = path.join(tempDir, 'schemaless-artifact-path-reject-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);
  const leaseToken = `schemaless-artifact-path-reject-token-${process.pid}`;
  await runnerNext({ runId, workflowPath, leaseToken });

  await assert.rejects(
    () => runnerWriteOutput({
      runId,
      workflowPath,
      stepId: 'prepare',
      json: JSON.stringify({ outcome: 'ready', artifacts: [{ id: 'outside', content_type: 'text/plain', path: '/tmp/a' }] }),
      leaseToken,
    }),
    /output schema validation failed for step 'prepare'.*artifact output directory/s,
  );
});

test('runner write-output rejects absolute artifact paths outside the current step artifact directory', async () => {
  const { runId, workflowPath, leaseToken } = await startArtifactOutputRun('outside-artifact-path-reject');

  await assert.rejects(
    () => runnerWriteOutput({
      runId,
      workflowPath,
      stepId: 'prepare',
      json: JSON.stringify({ outcome: 'ready', artifacts: [{ id: 'outside', content_type: 'text/markdown', path: '/tmp/outside-step.md' }] }),
      leaseToken,
    }),
    /output schema validation failed for step 'prepare'.*artifact output directory/s,
  );
});

test('runner write-output rejects another step artifact directory and traversal escapes', async () => {
  const { runId, runDir, workflowPath, leaseToken } = await startArtifactOutputRun('wrong-step-artifact-path-reject');
  const otherStepPath = path.join(runDir, 'branch_a', 'artifacts', 'packet.md');
  const traversalPath = path.join(runDir, 'prepare', 'artifacts', '..', '..', 'branch_b', 'artifacts', 'packet.md');

  for (const artifactPath of [otherStepPath, traversalPath]) {
    await assert.rejects(
      () => runnerWriteOutput({
        runId,
        workflowPath,
        stepId: 'prepare',
        json: JSON.stringify({ outcome: 'ready', artifacts: [{ id: 'packet', content_type: 'text/markdown', path: artifactPath }] }),
        leaseToken,
      }),
      /output schema validation failed for step 'prepare'.*artifact output directory/s,
    );
  }
});

test('runner write-output accepts artifact paths inside the current step artifact directory', async () => {
  const { runId, workflowPath, leaseToken, artifactDir } = await startArtifactOutputRun('valid-artifact-path-accept');
  const accepted = await runnerWriteOutput({
    runId,
    workflowPath,
    stepId: 'prepare',
    json: JSON.stringify({ outcome: 'ready', artifacts: [{ id: 'packet', content_type: 'text/markdown', path: path.join(artifactDir, 'packet.md') }] }),
    debugSummaryFile: debugSummaryFileFor({ runId, stepId: 'prepare' }),
    leaseToken,
  });

  assert.equal(accepted.ok, true);
});


test('runner write-output rejects symlinked current step artifact directory', async () => {
  const { runId, workflowPath, leaseToken, artifactDir } = await startArtifactOutputRun('symlinked-artifact-dir-reject');
  const outsideDir = path.join(tempDir, 'runner-symlinked-artifact-dir-outside');
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(path.dirname(artifactDir), { recursive: true });
  mkdirSync(outsideDir, { recursive: true });
  symlinkSync(outsideDir, artifactDir, 'dir');

  await assert.rejects(
    () => runnerWriteOutput({
      runId,
      workflowPath,
      stepId: 'prepare',
      json: JSON.stringify({ outcome: 'ready', artifacts: [{ id: 'packet', content_type: 'text/markdown', path: path.join(artifactDir, 'packet.md') }] }),
      leaseToken,
    }),
    /output schema validation failed for step 'prepare'.*not a symlink/s,
  );
});

test('runner API propagates custom runsRoot through next, instructions, and continue', async () => {
  const runId = `workflow-runner-test-${process.pid}-custom-runs-root`;
  const runsRoot = path.join(tempDir, 'custom-runs-root');
  const workflowPath = path.join(tempDir, 'custom-runs-root-workflow.json');
  const outputPath = path.join(tempDir, 'custom-runs-root-output.json');
  const leaseToken = `custom-runs-root-token-${process.pid}`;
  writeJson(workflowPath, workflowDoc);
  writeJson(outputPath, workerOutput('prepared under custom root'));
  rmSync(runsRoot, { recursive: true, force: true });

  const first = await runnerNext({ runId, workflowPath, runsRoot, leaseToken });

  assert.equal(first.status, 'needs_host_actions');
  assert.equal(first.requests[0].stepId, 'prepare');
  assert.equal(first.requests[0].loadInstructionsCommand.includes(`--runs-root '${runsRoot}'`), true);
  assert.equal(first.requests[0].loadFollowupInstructionsCommand.includes(`--runs-root '${runsRoot}'`), true);
  assert.equal(first.requests[0].loadInstructionsCommand.includes(`--lease-token '${leaseToken}'`), true);
  assert.equal(first.requests[0].loadFollowupInstructionsCommand.includes(`--lease-token '${leaseToken}'`), true);
  assert.equal(first.orchestratorInstruction.includes(`--runs-root '${runsRoot}'`), true);
  assert.equal(first.orchestratorInstruction.includes(`--lease-token '${leaseToken}'`), true);
  assert.equal(first.orchestratorInstruction.includes(`--bind-agent 'prepare=<agent-id>'`), true);
  assert.equal(first.orchestratorInstruction.includes(`--orchestrator-debug-json '<paste orchestrator debug JSON here>'`), true);
  assert.equal(first.orchestratorInstruction.includes('--only-instructions'), true);

  const instructions = await runnerLoadInstructions({ runId, stepId: 'prepare', runsRoot, leaseToken });
  assert.match(instructions, /Prepare branch\./);
  const followUpInstructions = await runnerLoadInstructions({ runId, stepId: 'prepare', followUp: true, runsRoot, leaseToken });
  assert.notEqual(followUpInstructions, instructions);
  assert.match(followUpInstructions, /This follow-up omits the full template and schema/);
  assert.match(followUpInstructions, /Output template: output\.md/);
  assert.doesNotMatch(followUpInstructions, /Return markdown\./);
  assert.match(followUpInstructions, /Prepare branch\./);
  assert.equal(followUpInstructions.includes(`--runs-root '${runsRoot}'`), true);
  assert.equal(followUpInstructions.includes(`--lease-token '${leaseToken}'`), true);

  const writeOutput = await runnerWriteOutput({
    runId,
    workflowPath,
    runsRoot,
    stepId: 'prepare',
    json: readFileSync(outputPath, 'utf8'),
    debugSummaryFile: debugSummaryFileFor({ runId, runsRoot, stepId: 'prepare' }),
    leaseToken,
  });
  assert.equal(writeOutput.ok, true);
  assert.equal(writeOutput.accepted, true);
  assert.equal(Object.hasOwn(writeOutput, 'orchestratorInstruction'), false);
  const continued = await runnerContinueRun({ runId, runsRoot, bindAgents: ['prepare=custom-root-worker'], leaseToken });

  assert.equal(continued.status, 'needs_host_actions');
  assert.equal(continued.requests[0].loadInstructionsCommand.includes(`--lease-token '${leaseToken}'`), true);
  assert.equal(continued.requests[0].loadFollowupInstructionsCommand.includes(`--lease-token '${leaseToken}'`), true);
  assert.equal(continued.orchestratorInstruction.includes('--only-instructions'), true);
  assert.deepEqual(continued.requests.map((request) => request.stepId), ['branch_a']);
  for (const request of continued.requests) {
    assert.equal(request.loadInstructionsCommand.includes(`--runs-root '${runsRoot}'`), true);
    assert.equal(request.loadFollowupInstructionsCommand.includes(`--runs-root '${runsRoot}'`), true);
  }
  const baton = JSON.parse(readFileSync(path.join(resolveRunPaths({ runId, runsRoot }).runDir, 'baton.json'), 'utf8'));
  assert.deepEqual(baton.workerBindings, { prepare: 'custom-root-worker' });
  assert.equal(existsSync(resolveRunPaths({ runId }).runDir), false);
});

test('runner API emits absolute runsRoot in portable commands for relative custom roots', async () => {
  const runId = `workflow-runner-test-${process.pid}-relative-runs-root-command`;
  const runsRoot = path.relative(process.cwd(), path.join(tempDir, 'relative-runs-root-command'));
  const resolvedRunsRoot = path.resolve(runsRoot);
  const workflowPath = path.join(tempDir, 'relative-runs-root-command-workflow.json');
  const leaseToken = `relative-runs-root-command-token-${process.pid}`;
  writeJson(workflowPath, workflowDoc);
  rmSync(resolvedRunsRoot, { recursive: true, force: true });

  const first = await runnerNext({ runId, workflowPath, runsRoot, leaseToken });

  assert.equal(first.status, 'needs_host_actions');
  assert.equal(first.requests[0].loadInstructionsCommand.includes(`--runs-root '${resolvedRunsRoot}'`), true);
  assert.equal(first.requests[0].loadInstructionsCommand.includes(`--runs-root '${runsRoot}'`), false);
  assert.equal(first.requests[0].loadFollowupInstructionsCommand.includes(`--runs-root '${resolvedRunsRoot}'`), true);
  assert.equal(first.orchestratorInstruction.includes(`--runs-root '${resolvedRunsRoot}'`), true);
});
