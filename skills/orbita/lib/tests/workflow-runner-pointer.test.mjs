// Exercises the public pointer-recovery control plane without touching dashboard internals.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import {
  continueRun,
  listPointerTransitions,
  movePointer,
  next,
  writeOutput,
} from './helpers/orbita-production-api.mjs';
import { getDashboardRun } from '../dashboard/api.mjs';
import { registerWorkflowRunAtRoot } from '../persistence/run-state/workflow-runs.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-runner-pointer-'));
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn JSON.\n');

const workflowDoc = {
  name: 'pointer-recovery-check',
  version: 1,
  start: 'prepare',
  done: 'done',
  steps: {
    prepare: {
      name: 'Prepare',
      kind: 'worker',
      input: { prompt: 'Prepare.' },
      output: { template: 'output.md' },
      next: 'review',
    },
    review: {
      name: 'Review',
      kind: 'worker',
      input: { prompt: 'Review.' },
      output: { template: 'output.md' },
      next: 'finalize',
    },
    finalize: {
      name: 'Finalize',
      kind: 'worker',
      input: { prompt: 'Finalize.' },
      output: { template: 'output.md' },
      next: 'done',
    },
    done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
  },
};

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function workflowPath(label, doc = workflowDoc) {
  const filePath = path.join(tempDir, `${label}.json`);
  writeJson(filePath, doc);
  return filePath;
}

async function createClaimedRun(label, doc = workflowDoc) {
  const workflow = workflowPath(label, doc);
  const runId = `workflow-runner-pointer-${process.pid}-${label}`;
  const paths = resolveRunPaths({ runId, workflowPath: workflow });
  rmSync(paths.runDir, { recursive: true, force: true });
  const claim = await registerWorkflowRunAtRoot({
    runId,
    workflowPath: workflow,
    claim: true,
    owner: 'pointer-test',
    harness: 'node-test',
    sessionId: `session-${label}`,
    leaseMs: 180 * 24 * 60 * 60 * 1000,
    now: new Date('2026-06-01T10:00:00.000Z'),
  });
  return { runId, workflowPath: workflow, paths, leaseToken: claim.leaseToken };
}

function workerOutput(summary) {
  return { outcome: 'ready', results: [{ type: 'check', summary }] };
}

function debugSummaryFileFor(paths, stepId) {
  const debugSummaryFile = path.join(paths.runDir, stepId, 'debug-summary.md');
  mkdirSync(path.dirname(debugSummaryFile), { recursive: true });
  writeFileSync(debugSummaryFile, `debug summary for ${stepId}\n`);
  return debugSummaryFile;
}

async function acceptCurrentWorkerOutput({ runId, workflowPath, paths, leaseToken, stepId, summary, now = new Date('2026-06-01T10:01:00.000Z') }) {
  return writeOutput({
    runId,
    workflowPath,
    stepId,
    json: JSON.stringify(workerOutput(summary)),
    debugSummaryFile: debugSummaryFileFor(paths, stepId),
    leaseToken,
    now,
  });
}

function snapshot(paths) {
  return {
    baton: JSON.parse(readFileSync(paths.batonPath, 'utf8')),
    history: readFileSync(paths.historyPath, 'utf8'),
    authority: JSON.parse(readFileSync(paths.authorityPath, 'utf8')),
    index: JSON.parse(readFileSync(paths.runsIndexPath, 'utf8')).runs[paths.runId],
  };
}

function rawRunFiles(paths) {
  const index = JSON.parse(readFileSync(paths.runsIndexPath, 'utf8'));
  return {
    baton: existsSync(paths.batonPath) ? readFileSync(paths.batonPath, 'utf8') : undefined,
    history: existsSync(paths.historyPath) ? readFileSync(paths.historyPath, 'utf8') : undefined,
    authority: existsSync(paths.authorityPath) ? readFileSync(paths.authorityPath, 'utf8') : undefined,
    indexEntry: index.runs[paths.runId],
  };
}

function durableAggregateBytes(paths) {
  return Object.fromEntries([
    ['journal', paths.durableCommitPath],
    ['baton', paths.batonPath],
    ['history', paths.historyPath],
    ['currentRequests', paths.currentRequestsPath],
    ['authority', paths.authorityPath],
  ].map(([key, pathname]) => [key, existsSync(pathname) ? readFileSync(pathname, 'utf8') : undefined]));
}

test('runner pointer API lists adjacent transitions and moves pointer with retained-state acknowledgement', async () => {
  const run = await createClaimedRun('api-retained');
  await next({ ...run, userPrompt: 'keep prompt marker', now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared' });
  await continueRun({ ...run, bindAgents: ['prepare=agent-prepare'], now: new Date('2026-06-01T10:02:00.000Z') });
  const beforeMove = snapshot(run.paths);

  const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T10:03:00.000Z') });
  assert.equal(listed.current.cursor, 'review');
  assert.deepEqual(listed.transitions.map((transition) => [transition.direction, transition.to.cursor]), [['backward', 'prepare']]);
  assert.equal(listed.transitions[0].retainedState.acknowledgementRequired, true);
  assert.deepEqual(listed.transitions[0].retainedState.stepIds, ['prepare']);
  assert.doesNotMatch(JSON.stringify(listed), /agent-prepare|keep prompt marker|workflow-runner-token|history\.md|baton\.json/);

  await assert.rejects(
    () => movePointer({ ...run, transitionId: listed.transitions[0].id, now: new Date('2026-06-01T10:04:00.000Z') }),
    /requires retained state acknowledgement/,
  );

  const moved = await movePointer({
    ...run,
    transitionId: listed.transitions[0].id,
    acknowledgeRetainedState: true,
    now: new Date('2026-06-01T10:05:00.000Z'),
  });
  const afterMove = snapshot(run.paths);

  assert.equal(moved.current.cursor, 'prepare');
  assert.equal(afterMove.baton.cursor, 'prepare');
  assert.equal(afterMove.baton.status, 'running');
  assert.deepEqual(afterMove.baton.state, beforeMove.baton.state);
  assert.deepEqual(afterMove.baton.workerBindings, beforeMove.baton.workerBindings);
  assert.equal(afterMove.baton.user_prompt_injected, beforeMove.baton.user_prompt_injected);
  assert.equal(afterMove.history.startsWith(beforeMove.history), true);
  assert.match(afterMove.history.slice(beforeMove.history.length), /source: workflow-runner-move-pointer/);
  assert.match(afterMove.history.slice(beforeMove.history.length), /pointer move:/);
  assert.match(afterMove.history.slice(beforeMove.history.length), /target position id:/);
  assert.match(afterMove.history.slice(beforeMove.history.length), /state preserved: true/);
  assert.match(afterMove.history.slice(beforeMove.history.length), /retained output acknowledgement: required/);
  assert.equal(afterMove.authority.status, 'needs_host_actions');
});

test('runner pointer API list is read-only for claimed runs without persisted state', async () => {
  const run = await createClaimedRun('api-read-only-missing-state');
  const before = {
    baton: existsSync(run.paths.batonPath),
    history: existsSync(run.paths.historyPath),
    lock: existsSync(run.paths.continueLockPath),
  };

  await assert.rejects(
    () => listPointerTransitions({ ...run, now: new Date('2026-06-01T10:01:00.000Z') }),
    /missing baton/,
  );

  assert.deepEqual({
    baton: existsSync(run.paths.batonPath),
    history: existsSync(run.paths.historyPath),
    lock: existsSync(run.paths.continueLockPath),
  }, before);
});

test('runner pointer API list remains read-only on existing-state failures and stale leases', async () => {
  const corruptRun = await createClaimedRun('api-read-only-existing-failure');
  await next({ ...corruptRun, now: new Date('2026-06-01T10:00:01.000Z') });
  const corruptBefore = rawRunFiles(corruptRun.paths);
  writeJson(corruptRun.paths.batonPath, { cursor: 'not-a-workflow-step', status: 'running', state: { artifacts: [], results: [] } });
  const corruptAfterWrite = rawRunFiles(corruptRun.paths);

  await assert.rejects(
    () => listPointerTransitions({ ...corruptRun, now: new Date('2026-06-01T10:01:00.000Z') }),
    /baton cursor not found in workflow/,
  );
  assert.deepEqual(rawRunFiles(corruptRun.paths), corruptAfterWrite);
  writeFileSync(corruptRun.paths.batonPath, corruptBefore.baton);

  const staleRun = await createClaimedRun('api-read-only-stale-lease');
  await next({ ...staleRun, now: new Date('2026-06-01T10:00:01.000Z') });
  const staleBefore = rawRunFiles(staleRun.paths);
  await assert.rejects(
    () => listPointerTransitions({ ...staleRun, now: new Date('2027-01-01T10:01:00.000Z') }),
    /workflow run lease is stale/,
  );
  assert.deepEqual(rawRunFiles(staleRun.paths), staleBefore);
});

test('runner pointer API list fails closed without recovering a pending durable transaction', async () => {
  const run = await createClaimedRun('api-read-only-pending-transaction');
  await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared pending transaction' });
  process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER = 'pending';
  try {
    await assert.rejects(
      () => continueRun({ ...run, now: new Date('2026-06-01T10:02:00.000Z') }),
      /injected durable commit failure after pending/,
    );
  } finally {
    delete process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER;
  }
  const before = rawRunFiles(run.paths);
  const pendingBefore = readFileSync(run.paths.durableCommitPath, 'utf8');

  await assert.rejects(
    () => listPointerTransitions({ ...run, now: new Date('2026-06-01T10:03:00.000Z') }),
    /durable workflow transaction is pending/,
  );

  assert.deepEqual(rawRunFiles(run.paths), before);
  assert.equal(readFileSync(run.paths.durableCommitPath, 'utf8'), pendingBefore);
});

test('runner pointer API move does not initialize missing state on rejected moves', async () => {
  const run = await createClaimedRun('api-move-missing-state');
  const before = {
    baton: existsSync(run.paths.batonPath),
    history: existsSync(run.paths.historyPath),
  };

  await assert.rejects(
    () => movePointer({
      ...run,
      transitionId: 'ptr_missing',
      acknowledgeRetainedState: true,
      now: new Date('2026-06-01T10:01:00.000Z'),
    }),
    /missing baton/,
  );

  assert.deepEqual({
    baton: existsSync(run.paths.batonPath),
    history: existsSync(run.paths.historyPath),
  }, before);
});

test('runner pointer API replays exact duplicate moves and rejects wrong leases without mutation', async () => {
  const run = await createClaimedRun('api-stale');
  await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared stale' });
  await continueRun({ ...run, now: new Date('2026-06-01T10:02:00.000Z') });
  const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T10:03:00.000Z') });
  const firstMove = await movePointer({ ...run, transitionId: listed.transitions[0].id, acknowledgeRetainedState: true, now: new Date('2026-06-01T10:04:00.000Z') });
  const beforeRejected = snapshot(run.paths);

  const replayedMove = await movePointer({ ...run, transitionId: listed.transitions[0].id, acknowledgeRetainedState: true, now: new Date('2026-06-01T12:05:00.000Z') });
  assert.deepEqual(replayedMove, firstMove);
  const afterStaleRejected = snapshot(run.paths);
  assert.deepEqual(afterStaleRejected.baton, beforeRejected.baton);
  assert.deepEqual(afterStaleRejected.index, beforeRejected.index);
  assert.equal(afterStaleRejected.history, beforeRejected.history);
  assert.equal(afterStaleRejected.authority.updatedAt, '2026-06-01T12:05:00.000Z');
  assert.equal(afterStaleRejected.authority.workerLease.leaseExpiresAt, '2026-06-01T13:05:00.000Z');

  await assert.rejects(
    () => listPointerTransitions({ ...run, leaseToken: 'wrong-token', now: new Date('2026-06-01T10:05:00.000Z') }),
    /workflow run is occupied/,
  );
  await assert.rejects(
    () => movePointer({ ...run, leaseToken: 'wrong-token', transitionId: 'ptr_wrong', now: new Date('2026-06-01T10:05:00.000Z') }),
    /workflow run is occupied/,
  );

  assert.deepEqual(snapshot(run.paths), afterStaleRejected);
});

test('expired matching leases cannot start fresh continue, pointer, or write-output mutations', async () => {
  const expiredAt = new Date('2026-06-01T12:05:00.000Z');

  const continueRunState = await createClaimedRun('api-expired-fresh-continue');
  await next({ ...continueRunState, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...continueRunState, stepId: 'prepare', summary: 'prepared before expiry' });
  const continueBefore = snapshot(continueRunState.paths);
  await assert.rejects(
    () => continueRun({ ...continueRunState, now: expiredAt }),
    /workflow run lease is stale/,
  );
  assert.deepEqual(snapshot(continueRunState.paths), continueBefore);

  const pointerRunState = await createClaimedRun('api-expired-fresh-pointer');
  await next({ ...pointerRunState, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...pointerRunState, stepId: 'prepare', summary: 'prepared for expired pointer' });
  await continueRun({ ...pointerRunState, now: new Date('2026-06-01T10:02:00.000Z') });
  const listed = await listPointerTransitions({ ...pointerRunState, now: new Date('2026-06-01T10:03:00.000Z') });
  const pointerBefore = snapshot(pointerRunState.paths);
  await assert.rejects(
    () => movePointer({
      ...pointerRunState,
      transitionId: listed.transitions[0].id,
      acknowledgeRetainedState: true,
      now: expiredAt,
    }),
    /workflow run lease is stale/,
  );
  assert.deepEqual(snapshot(pointerRunState.paths), pointerBefore);

  const outputRunState = await createClaimedRun('api-expired-fresh-write-output');
  await next({ ...outputRunState, now: new Date('2026-06-01T10:00:01.000Z') });
  const outputBefore = snapshot(outputRunState.paths);
  await assert.rejects(
    () => acceptCurrentWorkerOutput({
      ...outputRunState,
      stepId: 'prepare',
      summary: 'must not be accepted after expiry',
      now: expiredAt,
    }),
    /workflow run lease is stale/,
  );
  assert.deepEqual(snapshot(outputRunState.paths), outputBefore);
});

test('accepted output redacts the exact active lease token before persistence', async () => {
  const run = await createClaimedRun('api-accepted-output-token-redaction');
  await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({
    ...run,
    stepId: 'prepare',
    summary: `worker accidentally returned bare token ${run.leaseToken}`,
  });

  const persisted = readFileSync(run.paths.batonPath, 'utf8');
  assert.equal(persisted.includes(run.leaseToken), false);
  assert.match(persisted, /\[redacted-lease-token\]/);
  assert.equal(JSON.stringify(snapshot(run.paths)).includes(run.leaseToken), false);
  const dashboardRun = await getDashboardRun({ runId: run.runId, runsRoot: run.paths.runsRoot });
  assert.equal(JSON.stringify(dashboardRun).includes(run.leaseToken), false);
  assert.match(JSON.stringify(dashboardRun), /redacted-lease-token/);
});

test('expired matching lease may replay exact accepted output without duplicate mutation', async () => {
  const run = await createClaimedRun('api-expired-exact-write-output');
  await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
  const first = await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'accepted before expiry' });
  assert.equal(first.idempotent, undefined);
  const before = rawRunFiles(run.paths);

  const replay = await acceptCurrentWorkerOutput({
    ...run,
    stepId: 'prepare',
    summary: 'accepted before expiry',
    now: new Date('2026-06-01T12:05:00.000Z'),
  });
  assert.equal(replay.idempotent, true);
  const after = rawRunFiles(run.paths);
  assert.equal(after.baton, before.baton);
  assert.equal(after.history, before.history);
  assert.deepEqual(after.indexEntry, before.indexEntry);
  const authority = JSON.parse(after.authority);
  assert.equal(authority.updatedAt, '2026-06-01T12:05:00.000Z');
  assert.equal(authority.workerLease.leaseExpiresAt, '2026-06-01T13:05:00.000Z');
});

test('expired matching write-output does not recover an unrelated pending journal', async () => {
  const run = await createClaimedRun('api-expired-write-output-pending-journal');
  await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'accepted before pending continue' });
  process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER = 'pending';
  try {
    await assert.rejects(
      () => continueRun({ ...run, now: new Date('2026-06-01T10:02:00.000Z') }),
      /injected durable commit failure after pending/,
    );
  } finally {
    delete process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER;
  }
  const before = durableAggregateBytes(run.paths);

  await assert.rejects(
    () => acceptCurrentWorkerOutput({
      ...run,
      stepId: 'prepare',
      summary: 'accepted before pending continue',
      now: new Date('2026-06-01T12:05:00.000Z'),
    }),
    /workflow run lease is stale/,
  );
  assert.deepEqual(durableAggregateBytes(run.paths), before);
});

test('runner pointer API rejects mismatched pending retry and replays matching retry once recovered', async () => {
  const run = await createClaimedRun('api-pending-retry-fingerprint');
  await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared pending move' });
  await continueRun({ ...run, now: new Date('2026-06-01T10:02:00.000Z') });
  const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T10:03:00.000Z') });
  const transitionId = listed.transitions[0].id;

  process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER = 'pending';
  try {
    await assert.rejects(
      () => movePointer({ ...run, transitionId, acknowledgeRetainedState: true, now: new Date('2026-06-01T10:04:00.000Z') }),
      /injected durable commit failure after pending/,
    );
  } finally {
    delete process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER;
  }
  const pendingBefore = readFileSync(run.paths.durableCommitPath, 'utf8');
  await assert.rejects(
    () => movePointer({ ...run, transitionId, acknowledgeRetainedState: false, now: new Date('2026-06-01T10:05:00.000Z') }),
    /interrupted workflow-runner-move-pointer operation with different input/,
  );
  assert.equal(readFileSync(run.paths.durableCommitPath, 'utf8'), pendingBefore);

  const recovered = await movePointer({ ...run, transitionId, acknowledgeRetainedState: true, now: new Date('2026-06-01T12:06:00.000Z') });
  assert.equal(recovered.moved.id, transitionId);
  assert.equal(existsSync(run.paths.durableCommitPath), false);
  assert.equal((readFileSync(run.paths.historyPath, 'utf8').match(/source: workflow-runner-move-pointer/g) ?? []).length, 1);
  const renewed = snapshot(run.paths).authority;
  assert.equal(renewed.updatedAt, '2026-06-01T12:06:00.000Z');
  assert.equal(renewed.workerLease.leaseExpiresAt, '2026-06-01T13:06:00.000Z');
});

test('runner continue replay renews authority without duplicating workflow mutation', async () => {
  const cases = [
    ['to-next', workflowDoc, 'review'],
    ['to-done', {
      ...workflowDoc,
      steps: {
        prepare: { ...workflowDoc.steps.prepare, next: 'done' },
        done: workflowDoc.steps.done,
      },
    }, 'done'],
  ];
  for (const [label, workflow, expectedStatusOrCursor] of cases) {
    const run = await createClaimedRun(`continue-replay-${label}`, workflow);
    await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
    await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: `prepared ${label}` });
    const first = await continueRun({ ...run, now: new Date('2026-06-01T10:02:00.000Z') });
    assert.doesNotMatch(readFileSync(run.paths.operationReceiptPath, 'utf8'), new RegExp(run.leaseToken));
    const beforeReplay = rawRunFiles(run.paths);
    const replayed = await continueRun({ ...run, now: new Date('2026-06-01T12:03:00.000Z') });
    assert.deepEqual(replayed, first);
    const afterReplay = rawRunFiles(run.paths);
    assert.equal(afterReplay.baton, beforeReplay.baton);
    assert.equal(afterReplay.history, beforeReplay.history);
    assert.deepEqual(afterReplay.indexEntry, beforeReplay.indexEntry);
    const renewedAuthority = JSON.parse(afterReplay.authority);
    assert.equal(renewedAuthority.status, first.status);
    assert.equal(renewedAuthority.updatedAt, '2026-06-01T12:03:00.000Z');
    assert.equal(renewedAuthority.workerLease.leaseExpiresAt, '2026-06-01T13:03:00.000Z');
    assert.equal(first.status === 'done' ? first.status : first.baton.cursor, expectedStatusOrCursor);
    assert.equal((readFileSync(run.paths.historyPath, 'utf8').match(/source: workflow-runner-continue/g) ?? []).length, 1);
  }
});

test('runner pointer API allows rollback from terminal cursors', async () => {
  const terminalRun = await createClaimedRun('api-terminal');
  await next({ ...terminalRun, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...terminalRun, stepId: 'prepare', summary: 'prepared terminal' });
  await continueRun({ ...terminalRun, now: new Date('2026-06-01T10:02:00.000Z') });
  await acceptCurrentWorkerOutput({ ...terminalRun, stepId: 'review', summary: 'reviewed terminal' });
  await continueRun({ ...terminalRun, now: new Date('2026-06-01T10:03:00.000Z') });
  await acceptCurrentWorkerOutput({ ...terminalRun, stepId: 'finalize', summary: 'finalized terminal' });
  await continueRun({ ...terminalRun, now: new Date('2026-06-01T10:04:00.000Z') });
  const terminal = await listPointerTransitions({ ...terminalRun, now: new Date('2026-06-01T10:05:00.000Z') });
  assert.equal(terminal.unsupported, undefined);
  assert.deepEqual(terminal.transitions.map((transition) => [transition.direction, transition.to.cursor]), [['backward', 'finalize']]);
  assert.equal(terminal.transitions[0].retainedState.acknowledgementRequired, true);
  assert.deepEqual(terminal.transitions[0].retainedState.stepIds, ['finalize']);
  const terminalMoved = await movePointer({
    ...terminalRun,
    transitionId: terminal.transitions[0].id,
    acknowledgeRetainedState: true,
    now: new Date('2026-06-01T10:06:00.000Z'),
  });
  assert.equal(terminalMoved.current.cursor, 'finalize');
  assert.equal(terminalMoved.current.status, 'running');
  assert.equal(snapshot(terminalRun.paths).authority.status, 'needs_host_actions');

});

test('runner pointer API persists coherent activation state when moving into completed fanout and shard steps', async () => {
  const output = { template: 'output.md' };
  const cases = [
    ['fanout', {
      name: 'pointer-fanout-reactivation',
      version: 1,
      start: 'parallel',
      done: 'done',
      steps: {
        parallel: {
          name: 'Parallel',
          kind: 'fanout',
          max_parallel: 1,
          input: { branches: ['only'], prompt: 'Aggregate.' },
          output,
          branches: { only: { input: { prompt: 'Run only branch.' }, output } },
          next: 'done',
        },
        done: { name: 'Done', kind: 'done' },
      },
    }],
    ['shard', {
      name: 'pointer-shard-reactivation',
      version: 1,
      start: 'partition',
      done: 'done',
      steps: {
        partition: {
          name: 'Partition',
          kind: 'shard',
          max_parallel: 1,
          input: { shards: ['only'], prompt: 'Aggregate.' },
          output,
          worker: { input: { prompt: 'Run shard.' }, output },
          next: 'done',
        },
        done: { name: 'Done', kind: 'done' },
      },
    }],
  ];

  for (const [kind, workflow] of cases) {
    const run = await createClaimedRun(`api-${kind}-reactivation`, workflow);
    let response = await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
    for (let index = 0; response.status === 'needs_host_actions' && index < 5; index += 1) {
      for (const request of response.requests) {
        await acceptCurrentWorkerOutput({ ...run, stepId: request.stepId, summary: `${kind} first activation ${index}` });
      }
      response = await continueRun({ ...run, now: new Date('2026-06-01T10:02:00.000Z') });
    }
    assert.equal(response.status, 'done');
    const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T10:03:00.000Z') });
    const moved = await movePointer({
      ...run,
      transitionId: listed.transitions[0].id,
      acknowledgeRetainedState: true,
      now: new Date('2026-06-01T10:04:00.000Z'),
    });
    assert.equal(moved.current.status, 'running');
    const requestsDoc = JSON.parse(readFileSync(run.paths.currentRequestsPath, 'utf8'));
    const request = requestsDoc.requests[0];
    const baton = JSON.parse(readFileSync(run.paths.batonPath, 'utf8'));
    const activation = kind === 'fanout'
      ? baton.state.fanouts.parallel
      : baton.state.shards.partition;
    assert.equal(activation.activation, 2);
    assert.match(request.stepId, /__2__/);

    response = { status: 'needs_host_actions', requests: [request] };
    for (let index = 0; response.status === 'needs_host_actions' && index < 5; index += 1) {
      for (const currentRequest of response.requests) {
        await acceptCurrentWorkerOutput({ ...run, stepId: currentRequest.stepId, summary: `${kind} second activation ${index}` });
      }
      response = await continueRun({ ...run, now: new Date('2026-06-01T10:05:00.000Z') });
    }
    assert.equal(response.status, 'done');
  }
});


test('dashboard boundary stays read-only and does not import pointer recovery commands', () => {
  const dashboardFiles = [
    'skills/orbita/lib/entrypoints/api/dashboard.mjs',
    'skills/orbita/lib/dashboard/projection/run-state-projection.mjs',
    'skills/orbita/lib/dashboard/server/dashboard-event-publisher.mjs',
  ];
  for (const file of dashboardFiles) {
    if (!existsSync(path.join(root, file))) continue;
    const content = readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(content, /movePointer|listPointerTransitions|move-pointer|list-pointer-transitions/);
  }
});
