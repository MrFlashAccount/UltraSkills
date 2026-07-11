// Process-boundary coverage for recovery cuts that cannot be simulated by caught exceptions.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { continueRun, next, writeOutput } from './helpers/orbita-production-api.mjs';
import { readPersistedRunState } from '../persistence/run-state/PersistedRunStateReader.mjs';
import { readOperationReceipt } from '../persistence/run-state/durable-commit.mjs';
import { readRunAuthority } from '../persistence/run-state/run-authority.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { registerWorkflowRunAtRoot } from '../persistence/run-state/workflow-runs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const cliPath = path.join(root, 'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'workflow-runner-crash-recovery-'));
const runsRoot = path.join(tempRoot, 'runs');
const workflowPath = path.join(tempRoot, 'workflow.json');
const outputTemplatePath = path.join(tempRoot, 'output.md');

mkdirSync(runsRoot, { recursive: true });
writeFileSync(outputTemplatePath, '## Output contract\nReturn JSON.\n');
writeFileSync(workflowPath, `${JSON.stringify({
  name: 'crash-recovery',
  version: 1,
  start: 'prepare',
  done: 'done',
  steps: {
    prepare: { name: 'Prepare', kind: 'worker', input: { prompt: 'Prepare.' }, output: { template: 'output.md' }, next: 'review' },
    review: { name: 'Review', kind: 'worker', input: { prompt: 'Review.' }, output: { template: 'output.md' }, next: 'done' },
    done: { name: 'Done', kind: 'done' },
  },
}, null, 2)}\n`);

afterAll(() => rmSync(tempRoot, { recursive: true, force: true }));

async function preparedRun(label) {
  const runId = `workflow-runner-crash-${process.pid}-${label}`;
  const paths = resolveRunPaths({ runId, workflowPath, runsRoot });
  const startedAt = new Date();
  const claim = await registerWorkflowRunAtRoot({
    runId,
    workflowPath,
    runsRoot,
    claim: true,
    owner: 'crash-recovery-test',
    harness: 'bun-test',
    sessionId: `session-${label}`,
    now: startedAt,
  });
  await next({ runId, workflowPath, runsRoot, leaseToken: claim.leaseToken, now: new Date(startedAt.getTime() + 1_000) });
  const debugSummaryFile = path.join(paths.runDir, 'prepare', 'debug-summary.md');
  mkdirSync(path.dirname(debugSummaryFile), { recursive: true });
  writeFileSync(debugSummaryFile, 'prepared crash recovery fixture\n');
  await writeOutput({
    runId,
    workflowPath,
    runsRoot,
    stepId: 'prepare',
    json: JSON.stringify({ outcome: 'ready', results: [{ type: 'check', summary: `prepared ${label}` }] }),
    debugSummaryFile,
    leaseToken: claim.leaseToken,
    now: new Date(startedAt.getTime() + 2_000),
  });
  return { runId, paths, leaseToken: claim.leaseToken, startedAt };
}

function crashContinue(run, env) {
  return spawnSync(process.execPath, [
    cliPath,
    'continue',
    '--run-id', run.runId,
    '--workflow', workflowPath,
    '--runs-root', runsRoot,
    '--lease-token', run.leaseToken,
  ], {
    cwd: root,
    env: { ...process.env, WORKFLOW_RUNNER_ENABLE_TEST_CRASH_HOOKS: '1', ...env },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

test('operation receipts require a non-empty commit id replay proof', async () => {
  const run = await preparedRun('malformed-receipt-commit-id');
  await continueRun({ runId: run.runId, workflowPath, runsRoot, leaseToken: run.leaseToken, now: new Date(run.startedAt.getTime() + 3_000) });
  const receipt = JSON.parse(readFileSync(run.paths.operationReceiptPath, 'utf8'));
  writeFileSync(run.paths.operationReceiptPath, `${JSON.stringify({ ...receipt, commitId: '' })}\n`);
  await assert.rejects(() => readOperationReceipt(run.paths), /workflow operation receipt is invalid/);
});

function ageCrashedProcessLock(paths) {
  const metadata = JSON.parse(readFileSync(paths.continueLockPath, 'utf8'));
  writeFileSync(paths.continueLockPath, `${JSON.stringify({ ...metadata, heartbeatAt: '1970-01-01T00:00:00.000Z' })}\n`);
}

for (const crashCut of ['baton', 'receipt', 'before-authority-renewal']) {
  test(`runner exact replay recovers real process death at ${crashCut} without duplicate state`, async () => {
    const run = await preparedRun(crashCut);
    const authorityBeforeCrash = readFileSync(run.paths.authorityPath, 'utf8');
    const crashed = crashContinue(run, crashCut === 'before-authority-renewal'
      ? { WORKFLOW_RUNNER_CRASH_BEFORE_AUTHORITY_RENEWAL: '1' }
      : { WORKFLOW_RUNNER_CRASH_DURABLE_COMMIT_AFTER: crashCut });

    assert.equal(crashed.status, 86, `unexpected child result\nstdout:\n${crashed.stdout}\nstderr:\n${crashed.stderr}`);
    assert.equal(existsSync(run.paths.durableCommitPath), crashCut !== 'before-authority-renewal');
    assert.equal(existsSync(run.paths.operationReceiptPath), crashCut !== 'baton');
    assert.equal(readFileSync(run.paths.authorityPath, 'utf8'), authorityBeforeCrash);
    ageCrashedProcessLock(run.paths);

    const retryNow = new Date(run.startedAt.getTime() + 60_000);
    const recovered = await continueRun({
      runId: run.runId,
      workflowPath,
      runsRoot,
      leaseToken: run.leaseToken,
      now: retryNow,
    });
    assert.equal(recovered.status, 'needs_host_actions');
    assert.equal(recovered.baton.cursor, 'review');
    assert.equal(existsSync(run.paths.durableCommitPath), false);

    const state = await readPersistedRunState(run.paths);
    assert.equal(state.baton.cursor, 'review');
    assert.deepEqual(state.currentRequests.map((request) => request.stepId), ['review']);
    assert.equal((state.history.text.match(/^- source: workflow-runner-continue$/gm) ?? []).length, 1);
    const receipt = JSON.parse(readFileSync(run.paths.operationReceiptPath, 'utf8'));
    assert.equal(receipt.operation, 'workflow-runner-continue');
    const authority = await readRunAuthority(run.paths);
    assert.equal(authority.updatedAt, retryNow.toISOString());
    assert.equal(authority.status, recovered.status);
  });
}
