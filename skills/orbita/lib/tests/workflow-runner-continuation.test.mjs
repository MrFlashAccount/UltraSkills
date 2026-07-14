import assert from 'node:assert/strict';
import { claimWorkflowRunForTest, runWorkflowRunnerApi } from './helpers/workflow-runner-api-client.mjs';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { next as runnerNext } from './helpers/orbita-production-api.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { publicFailureHistoryDetails } from '../runner/history-projection.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-runner-check-'));
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn markdown.\n');
writeFileSync(path.join(tempDir, 'output.schema.json'), `${JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome'],
  properties: {
    outcome: { type: 'string' },
  },
  additionalProperties: true,
}, null, 2)}\n`);
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
        output: { template: 'output.md', schema: 'output.schema.json' },
        next: 'branch_a',
      },
      branch_a: {
        name: 'Branch A',
        kind: 'worker',
        input: { prompt: 'Run branch A.' },
        output: { template: 'output.md', schema: 'output.schema.json' },
        next: 'branch_b',
      },
      branch_b: {
        name: 'Branch B',
        kind: 'worker',
        input: { prompt: 'Run branch B.' },
        output: { template: 'output.md', schema: 'output.schema.json' },
        next: 'join',
      },
      join: {
        name: 'Join',
        kind: 'worker',
        input: { prompt: 'Join branch output.' },
        output: { template: 'output.md', schema: 'output.schema.json' },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
    },

};

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

async function expectRunner(args, label) {
  const result = await runRunner(args);
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function currentRequests(runId, workflowPath) {
  const response = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'derive current requests');
  return response.requests ?? [];
}

async function currentRequestIds(runId, workflowPath) {
  return (await currentRequests(runId, workflowPath)).map((request) => request.stepId ?? request.id);
}

function parseOutputRef(ref) {
  const separator = ref.indexOf('=');
  if (separator < 0) return { stepId: undefined, filePath: ref };
  return { stepId: ref.slice(0, separator), filePath: ref.slice(separator + 1) };
}

async function writeOutputFile({ runId, runDir, workflowPath, stepId, filePath, label = 'write output', options = {} }) {
  const requests = await currentRequests(runId, workflowPath);
  const pendingIds = requests.map((request) => request.stepId ?? request.id);
  const targetStepId = stepId ?? pendingIds[0];
  const request = requests.find((item) => (item.stepId ?? item.id) === targetStepId);
  const result = await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', targetStepId], { input: readFileSync(filePath, 'utf8'), debugSummary: request?.action === 'run_worker', ...options });
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function continueWithOutputs({ runId, runDir, workflowPath, refs, label = 'continue', options = {} }) {
  const normalized = Array.isArray(refs) ? refs : [refs];
  const pendingIds = await currentRequestIds(runId, workflowPath);
  for (const ref of normalized) {
    const { stepId, filePath } = parseOutputRef(ref);
    const targetStepId = stepId ?? (pendingIds.length === 1 ? pendingIds[0] : undefined);
    assert.ok(targetStepId, `output for ${label} must name a step when multiple requests are pending`);
    await writeOutputFile({ runId, runDir, workflowPath, stepId: targetStepId, filePath, label: `${label} write ${targetStepId}` });
  }
  return await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], label, options);
}

function workerOutput(summary) {
  return { outcome: 'ready', results: [{ type: 'check', summary }] };
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));



test('runner: continue reports missing requested output as an error', async () => {
  const { runId, runDir } = await runCase('missing-output');
  const workflowPath = path.join(tempDir, 'missing-output-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next missing');
  const result = await runRunner(['continue', '--run-id', runId, '--workflow', workflowPath]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing completed output or non-blocking stop/);
});

test('runner: continue does not persist applied output when approval projection fails', async () => {
  const { runId, runDir } = await runCase('approval-projection-failure-no-advance');
  const workflowPath = path.join(tempDir, 'approval-projection-failure-no-advance-workflow.json');
  const outputSchemaPath = path.join(tempDir, 'approval-projection-producer.schema.json');
  writeJson(outputSchemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'summary'],
    properties: {
      outcome: { type: 'string' },
      summary: { type: 'string' },
    },
    additionalProperties: false,
  });
  const projectionFailureWorkflow = structuredClone(workflowDoc);
  projectionFailureWorkflow.steps.prepare.output.schema = path.basename(outputSchemaPath);
  projectionFailureWorkflow.steps.prepare.next = 'approval_gate';
  projectionFailureWorkflow.steps.approval_gate = {
    name: 'Approval gate',
    kind: 'approval',
    input: { summary: '${{ input.prepare.summary }}' },
    next: { match: '${{ output.approval }}', cases: { approved: 'done', rejected: 'done' } },
  };
  writeJson(workflowPath, projectionFailureWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next approval projection failure setup');
  const outputPath = path.join(runDir, 'prepare-result.json');
  writeJson(outputPath, { outcome: 'ready', summary: '' });
  await writeOutputFile({ runId, runDir, workflowPath, stepId: 'prepare', filePath: outputPath, label: 'write approval projection failure output' });
  const batonBefore = readFileSync(path.join(runDir, 'baton.json'), 'utf8');
  const historyBefore = readFileSync(path.join(runDir, 'history.md'), 'utf8');

  const result = await runRunner(['continue', '--run-id', runId, '--workflow', workflowPath]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /approval projection failed: input\.summary must resolve to a non-empty string/);
  assert.equal(readFileSync(path.join(runDir, 'baton.json'), 'utf8'), batonBefore);
  const failureHistory = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  const failureEntry = failureHistory.slice(historyBefore.length);
  assert.match(failureEntry, /source: workflow-runner-failure/);
  assert.match(failureEntry, /public failure: command=continue/);
  assert.match(failureEntry, /approval projection failed: input\.summary must resolve to a non-empty string/);
  assert.doesNotMatch(failureEntry, /source: workflow-runner-continue/);

  const baton = JSON.parse(batonBefore);
  assert.equal(baton.cursor, 'prepare');
  assert.equal(Object.hasOwn(baton.state, 'prepare'), true);
  assert.equal(baton.state.prepare.summary, '');
});


test('runner: continue recovers from post-render durable commit failure without mismatched next state', async () => {
  for (const failurePoint of ['pending', 'history', 'baton']) {
    const { runId, runDir } = await runCase(`durable-commit-${failurePoint}-failure`);
    const workflowPath = path.join(tempDir, `durable-commit-${failurePoint}-failure-workflow.json`);
    const singleWorkflow = structuredClone(workflowDoc);
    singleWorkflow.steps.prepare.next = 'join';
    singleWorkflow.steps.join.input.prompt = 'Join branch output:\n${{ input.prepare }}';
    writeJson(workflowPath, singleWorkflow);

    await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], `next durable commit ${failurePoint} failure setup`);
    const outputPath = path.join(runDir, 'prepare-result.json');
    writeJson(outputPath, workerOutput(`prepared after durable ${failurePoint} retry`));
    await writeOutputFile({ runId, runDir, workflowPath, stepId: 'prepare', filePath: outputPath, label: `write durable ${failurePoint} output` });
    const batonBefore = readFileSync(path.join(runDir, 'baton.json'), 'utf8');
    const historyBefore = readFileSync(path.join(runDir, 'history.md'), 'utf8');
    const failed = await runRunner(['continue', '--run-id', runId, '--workflow', workflowPath], {
      env: { WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER: failurePoint },
    });

    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, new RegExp(`injected durable commit failure after ${failurePoint}`));
    assert.equal(readFileSync(path.join(runDir, 'baton.json'), 'utf8'), batonBefore);
    assert.equal(readFileSync(path.join(runDir, 'history.md'), 'utf8'), historyBefore);
    assert.equal(existsSync(path.join(runDir, '.workflow-runner', 'durable-commit.json')), true);

    const recovered = await runRunner(['instructions', '--run-id', runId, '--step-id', 'join']);
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.match(recovered.stdout, new RegExp(`prepared after durable ${failurePoint} retry`));
    assert.equal(existsSync(path.join(runDir, '.workflow-runner', 'durable-commit.json')), false);

    const baton = JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
    const nextResponse = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], `derive recovered response ${failurePoint}`);
    assert.equal(baton.cursor, 'join');
    assert.equal(nextResponse.status, 'needs_host_actions');
    assert.deepEqual(nextResponse.requests.map((request) => request.id), ['join']);
    assert.equal(baton.state.prepare.results[0].summary, `prepared after durable ${failurePoint} retry`);
    assert.match(readFileSync(path.join(runDir, 'history.md'), 'utf8'), /output: accepted:prepare/);
  }
});

test('runner: durable commit recovery rejects symlinked history without reading outside target', async () => {
  const { runId, runDir } = await runCase('durable-commit-history-symlink-escape');
  const workflowPath = path.join(tempDir, 'durable-commit-history-symlink-escape-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next durable history symlink escape setup');
  const outsideSecret = path.join(tempDir, 'durable-commit-history-outside-secret.txt');
  writeFileSync(outsideSecret, 'outside secret must not be read or overwritten\n');
  rmSync(path.join(runDir, 'history.md'), { force: true });
  symlinkSync(outsideSecret, path.join(runDir, 'history.md'), 'file');
  const outputPath = path.join(runDir, 'prepare-result.json');
  writeJson(outputPath, workerOutput('prepared'));

  const result = await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'prepare'], { input: readFileSync(outputPath, 'utf8'), debugSummary: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /workflow history.*symlink|symlink.*history/);
  assert.equal(readFileSync(outsideSecret, 'utf8'), 'outside secret must not be read or overwritten\n');
  assert.equal(existsSync(path.join(runDir, '.workflow-runner', 'durable-commit.json')), false);
});

test('runner: history records accepted output debug summary and preserves sparse startup baseline', async () => {
  const { runId, runDir } = await runCase('accepted-output-debug-history');
  const workflowPath = path.join(tempDir, 'accepted-output-debug-history-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next accepted output debug history');
  const sparseHistory = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(sparseHistory, /source: workflow-runner/);
  assert.match(sparseHistory, /requests: id=prepare action=run_worker/);
  assert.doesNotMatch(sparseHistory, /accepted output summary/);

  const debugSummaryText = `${Array.from({ length: 90 }, (_, index) => `reasoning line ${index + 1}`).join('\n')}\n`;
  const outputPath = path.join(runDir, 'prepare-debug-output.json');
  writeJson(outputPath, {
    outcome: 'ready',
    results: [{ type: 'check', summary: 'debug history smoke passed' }],
  });

  await writeOutputFile({ runId, runDir, workflowPath, stepId: 'prepare', filePath: outputPath, label: 'write debug history output', options: { debugSummaryText } });
  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(history, /accepted output summary: step=prepare action=run_worker/);
  assert.match(history, /outcome: ready/);
  assert.match(history, /results: count=1 summaries=debug history smoke passed/);
  assert.match(history, /debug-summary body:/);
  assert.match(history, /reasoning line 80/);
  assert.doesNotMatch(history, /reasoning line 81/);
  assert.match(history, /\[truncated: limit 4096 bytes\/80 lines\]/);
});

test('runner: debug summary history reads only a bounded regular-file prefix', async () => {
  const { runId, runDir } = await runCase('accepted-output-debug-history-large-file');
  const workflowPath = path.join(tempDir, 'accepted-output-debug-history-large-file-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next large debug history');
  const outputPath = path.join(runDir, 'prepare-large-debug-output.json');
  writeJson(outputPath, {
    outcome: 'ready',
  });

  await writeOutputFile({
    runId,
    runDir,
    workflowPath,
    stepId: 'prepare',
    filePath: outputPath,
    label: 'write large debug history output',
    options: { debugSummaryText: `${'a'.repeat(4096)}TAIL-MUST-NOT-APPEAR\n` },
  });
  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(history, /debug-summary body:/);
  assert.doesNotMatch(history, /TAIL-MUST-NOT-APPEAR/);
  assert.match(history, /\[truncated: limit 4096 bytes\/80 lines\]/);
});

test('runner: write-output rejects non-regular debug summary side-channel before accepting output', async () => {
  const { runId, runDir } = await runCase('accepted-output-debug-history-fifo');
  const workflowPath = path.join(tempDir, 'accepted-output-debug-history-fifo-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next fifo debug history');
  const debugSummaryPath = path.join(runDir, 'prepare', 'debug-summary.md');
  mkdirSync(debugSummaryPath, { recursive: true });
  const outputPath = path.join(runDir, 'prepare-fifo-debug-output.json');
  writeJson(outputPath, {
    outcome: 'ready',
  });

  const result = await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'prepare', '--debug-summary-file', debugSummaryPath], { input: readFileSync(outputPath, 'utf8') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /debug summary file is required but unavailable \(ENOTREG\)/);
  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.doesNotMatch(history, /accepted output summary: step=prepare/);
  assert.doesNotMatch(history, /debug-summary body:/);
});

test('runner: accepted output history redacts copied lease tokens from summaries and debug body', async () => {
  const { runId, runDir } = await runCase('accepted-output-redacts-lease-token');
  const workflowPath = path.join(tempDir, 'accepted-output-redacts-lease-token-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next accepted output lease redaction');
  const leaseToken = leaseTokensByRunId.get(runId);
  assert.ok(leaseToken, 'test run should have a claimed lease token');
  const outputPath = path.join(runDir, 'prepare-redacted-debug-output.json');
  writeJson(outputPath, {
    outcome: 'ready',
    results: [{ type: 'check', summary: `command includes --lease-token ${leaseToken}` }],
  });

  await writeOutputFile({
    runId,
    runDir,
    workflowPath,
    stepId: 'prepare',
    filePath: outputPath,
    label: 'write redacted debug history output',
    options: { debugSummaryText: `Copied command: workflow-runner write-output --lease-token '${leaseToken}'\nRaw token: ${leaseToken}\n` },
  });
  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.doesNotMatch(history, new RegExp(leaseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(history, /\[redacted-lease-token\]/);
});

test('runner: disabled debug history suppresses rich side-channel body but keeps fallback summary', async () => {
  const { runId, runDir } = await runCase('debug-history-disabled');
  const workflowPath = path.join(tempDir, 'debug-history-disabled-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next disabled debug history');
  const outputPath = path.join(runDir, 'prepare-disabled-debug-output.json');
  writeJson(outputPath, {
    outcome: 'ready',
  });

  await writeOutputFile({
    runId,
    runDir,
    workflowPath,
    stepId: 'prepare',
    filePath: outputPath,
    label: 'write disabled debug history output',
    options: { env: { WORKFLOW_RUNNER_DEBUG_HISTORY: '0' }, debugSummaryText: 'suppressed worker reasoning\n' },
  });

  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(history, /accepted output summary: step=prepare action=run_worker/);
  assert.match(history, /debug-summary: rich body disabled/);
  assert.doesNotMatch(history, /suppressed worker reasoning/);
});

test('runner: continue orchestrator debug note appends bounded host rationale', async () => {
  const { runId, runDir } = await runCase('orchestrator-debug-history');
  const workflowPath = path.join(tempDir, 'orchestrator-debug-history-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'review';
  singleWorkflow.steps.review = {
    name: 'Review',
    kind: 'worker',
    input: { prompt: 'Review.' },
    output: singleWorkflow.steps.prepare.output,
    next: 'done',
  };
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next orchestrator debug history');
  const leaseToken = leaseTokensByRunId.get(runId);
  const note = {
    summary: 'spawned prepare worker and accepted its output',
    reasoning: 'The current runner request was run_worker for prepare, so host delegated only that step before continue.',
    commands: [
      `workflow-runner instructions --lease-token ${leaseToken}`,
      "workflow-runner continue --bind-agent 'prepare=worker-1'",
    ],
    validation: 'worker reported accepted write-output',
    risks: 'none known',
  };

  const prepareOutputPath = path.join(runDir, 'prepare-orchestrator-debug-output.json');
  writeJson(prepareOutputPath, workerOutput('prepared'));
  await writeOutputFile({
    runId,
    runDir,
    workflowPath,
    stepId: 'prepare',
    filePath: prepareOutputPath,
    label: 'write prepare before orchestrator debug',
  });

  const continued = await expectRunner([
    'continue',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--orchestrator-debug-json', JSON.stringify(note),
  ], 'continue to next orchestrator debug cycle');
  assert.equal(continued.status, 'needs_host_actions');
  assert.deepEqual(continued.requests.map((request) => request.stepId), ['review']);

  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(history, /source: workflow-runner-continue-orchestrator/);
  assert.match(history, /orchestrator debug summary:/);
  assert.match(history, /spawned prepare worker and accepted its output/);
  assert.match(history, /workflow-runner continue --bind-agent 'prepare=worker-1'/);
  assert.doesNotMatch(history, new RegExp(leaseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(history, /\[redacted-lease-token\]/);
  assert.equal((history.match(/orchestrator debug summary:/g) ?? []).length, 1);

  const reviewOutputPath = path.join(runDir, 'review-orchestrator-debug-output.json');
  writeJson(reviewOutputPath, workerOutput('reviewed'));
  await writeOutputFile({
    runId,
    runDir,
    workflowPath,
    stepId: 'review',
    filePath: reviewOutputPath,
    label: 'write review before repeated orchestrator debug',
  });
  await expectRunner([
    'continue',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--orchestrator-debug-json', JSON.stringify(note),
  ], 'record repeated note in next host cycle');
  const nextCycleHistory = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.equal((nextCycleHistory.match(/orchestrator debug summary:/g) ?? []).length, 2);
});

test('runner: public continue failure history is safely attributable and deduplicated', async () => {
  const { runId, runDir } = await runCase('public-failure-history');
  const workflowPath = path.join(tempDir, 'public-failure-history-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next public failure history');
  const failed = await runRunner(['continue', '--run-id', runId, '--workflow', workflowPath]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /missing completed output or non-blocking stop/);

  const failedAgain = await runRunner(['continue', '--run-id', runId, '--workflow', workflowPath]);
  assert.notEqual(failedAgain.status, 0);
  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(history, /source: workflow-runner-failure/);
  assert.match(history, /public failure: command=continue/);
  assert.match(history, /missing completed output or non-blocking stop for workflow request prepare/);
  assert.equal((history.match(/public failure: command=continue/g) ?? []).length, 1);
});

test('runner: public failure history redacts exact lease token outside option syntax', async () => {
  const { runId, runDir } = await runCase('public-failure-history-redacts-token-step-id');
  const workflowPath = path.join(tempDir, 'public-failure-history-redacts-token-step-id-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next public failure token redaction');
  const leaseToken = leaseTokensByRunId.get(runId);
  assert.ok(leaseToken, 'test run should have a claimed lease token');
  const failed = await runRunner(['instructions', '--run-id', runId, '--workflow', workflowPath, '--step-id', leaseToken]);
  assert.notEqual(failed.status, 0);

  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(history, /source: workflow-runner-failure/);
  assert.match(history, /public failure: command=instructions/);
  assert.doesNotMatch(history, new RegExp(leaseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(history, /\[redacted-lease-token\]/);
});

test('runner: public failure history details bound long public errors with a truncation marker', async () => {
  const details = publicFailureHistoryDetails({
    command: 'continue',
    error: Array.from({ length: 50 }, (_, index) => `public error line ${index + 1}`).join('\n'),
  }).join('\n');

  assert.match(details, /public error line 40/);
  assert.doesNotMatch(details, /public error line 41/);
  assert.match(details, /\[truncated: limit 2048 bytes\/40 lines\]/);
});

test('runner: continue history includes transition and terminal context', async () => {
  const { runId, runDir } = await runCase('terminal-transition-history');
  const workflowPath = path.join(tempDir, 'terminal-transition-history-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next terminal transition history');
  const outputPath = path.join(runDir, 'prepare-terminal-output.json');
  writeJson(outputPath, workerOutput('terminal transition complete'));
  const response = await continueWithOutputs({ runId, runDir, workflowPath, refs: outputPath, label: 'continue terminal transition' });

  assert.equal(response.status, 'done');
  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(history, /transition: cursor=prepare status=running -> cursor=done status=done/);
  assert.match(history, /terminal: status=done cursor=done/);
  assert.match(history, /next requests: none/);
});
