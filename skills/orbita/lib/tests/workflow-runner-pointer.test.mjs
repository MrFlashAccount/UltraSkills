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

test('runner pointer API rejects stale transition ids and wrong leases without mutation', async () => {
  const run = await createClaimedRun('api-stale');
  await next({ ...run, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared stale' });
  await continueRun({ ...run, now: new Date('2026-06-01T10:02:00.000Z') });
  const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T10:03:00.000Z') });
  await movePointer({ ...run, transitionId: listed.transitions[0].id, acknowledgeRetainedState: true, now: new Date('2026-06-01T10:04:00.000Z') });
  const beforeRejected = snapshot(run.paths);

  await assert.rejects(
    () => movePointer({ ...run, transitionId: listed.transitions[0].id, acknowledgeRetainedState: true, now: new Date('2026-06-01T10:05:00.000Z') }),
    /stale, non-adjacent, or not observed/,
  );
  const afterStaleRejected = snapshot(run.paths);
  assert.deepEqual(afterStaleRejected.baton, beforeRejected.baton);
  assert.deepEqual(afterStaleRejected.index, beforeRejected.index);
  assert.equal(afterStaleRejected.history, beforeRejected.history);

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

test('runner pointer API allows rollback from terminal cursors and reports parallel cursors as unsupported', async () => {
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

  const parallelWorkflow = structuredClone(workflowDoc);
  parallelWorkflow.steps.prepare.next = ['branch_a', 'branch_b'];
  parallelWorkflow.steps.branch_a = {
    name: 'Branch A',
    kind: 'worker',
    input: { prompt: 'Branch A.' },
    output: { template: 'output.md' },
    next: 'review',
  };
  parallelWorkflow.steps.branch_b = {
    name: 'Branch B',
    kind: 'worker',
    input: { prompt: 'Branch B.' },
    output: { template: 'output.md' },
    next: 'review',
  };
  const parallelRun = await createClaimedRun('api-parallel', parallelWorkflow);
  await next({ ...parallelRun, now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...parallelRun, stepId: 'prepare', summary: 'prepared parallel' });
  await continueRun({ ...parallelRun, now: new Date('2026-06-01T10:02:00.000Z') });
  const parallel = await listPointerTransitions({ ...parallelRun, now: new Date('2026-06-01T10:03:00.000Z') });
  assert.equal(parallel.unsupported.reason, 'parallel_cursor_unsupported');
  assert.deepEqual(parallel.transitions, []);
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
