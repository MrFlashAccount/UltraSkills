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
  reportStop,
  writeOutput,
} from './helpers/orbita-production-api.mjs';
import { registerWorkflowRunAtRoot } from '../persistence/run-state/workflow-runs.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { projectPointerTransitions } from '../runner/pointer-transition-projection.mjs';

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

test('pointer projection follows current workflow branches and excludes stale downstream state', () => {
  const workflow = {
    name: 'pointer-current-branch',
    version: 1,
    start: 'prepare',
    done: 'done',
    steps: {
      prepare: { name: 'Prepare', kind: 'worker', next: 'decide' },
      decide: {
        name: 'Decide',
        kind: 'worker',
        next: { match: '${{ output.route }}', cases: { left: 'left', right: 'right' } },
      },
      left: { name: 'Old branch', kind: 'worker', next: 'done' },
      right: { name: 'Current branch', kind: 'worker', next: 'done' },
      done: { name: 'Done', kind: 'done' },
    },
  };
  const baton = {
    cursor: 'right',
    status: 'running',
    state: {
      artifacts: [],
      results: [],
      prepare: { outcome: 'ready' },
      decide: { outcome: 'ready', route: 'right' },
      left: { outcome: 'ready' },
    },
  };

  const projected = projectPointerTransitions({ workflow, baton });

  assert.deepEqual(projected.transitions.map((transition) => transition.to.cursor), ['decide', 'prepare']);
  assert.equal(projected.transitions.some((transition) => transition.to.cursor === 'left'), false);
});

test('pointer projection handles resolved cycles using baton membership', () => {
  const workflow = {
    name: 'pointer-cycle',
    version: 1,
    start: 'a',
    done: 'done',
    steps: {
      a: { name: 'A', kind: 'worker', next: 'b' },
      b: { name: 'B', kind: 'worker', next: 'c' },
      c: { name: 'C', kind: 'worker', next: 'a' },
      done: { name: 'Done', kind: 'done' },
    },
  };
  const baton = {
    cursor: 'c',
    status: 'running',
    state: {
      artifacts: [],
      results: [],
      a: { outcome: 'ready' },
      b: { outcome: 'ready' },
      c: { outcome: 'ready' },
    },
  };

  const projected = projectPointerTransitions({ workflow, baton });

  assert.deepEqual(projected.transitions.map((transition) => transition.to.cursor), ['b', 'a']);
});

test('pointer projection uses the runtime loop-limit exit and offers only state-bearing predecessors', () => {
  const workflow = {
    name: 'pointer-loop-limit',
    version: 1,
    start: 'implement',
    done: 'done',
    loopPolicies: {
      implementation_review: {
        steps: ['implement', 'review'],
        entry: 'implement',
        boundary: 'review',
        maxIterations: 2,
        onLimit: '${{ output.limit_target }}',
      },
    },
    steps: {
      implement: { name: 'Implement', kind: 'worker', next: 'review' },
      review: {
        name: 'Review',
        kind: 'worker',
        next: { match: '${{ output.route }}', cases: { retry: 'implement', ready: 'done', limit_reached: 'limit_reached' } },
      },
      done: { name: 'Done', kind: 'done' },
      limit_reached: { name: 'Limit reached', kind: 'done' },
    },
  };
  const baton = {
    cursor: 'limit_reached',
    status: 'done',
    state: {
      artifacts: [],
      results: [],
      $loopProgress: { implementation_review: 2 },
      implement: { outcome: 'ready' },
      review: { outcome: 'ready', route: 'retry', limit_target: 'limit_reached' },
      done: { outcome: 'ready' },
    },
  };

  const projected = projectPointerTransitions({ workflow, baton });

  assert.deepEqual(projected.transitions.map((transition) => transition.to.cursor), ['review', 'implement']);
  assert.equal(projected.transitions.some((transition) => transition.to.cursor === 'done'), false);
});

test('runner pointer API moves to a state-bearing predecessor while preserving replaceable state', async () => {
  const run = await createClaimedRun('api-retained');
  await next({ ...run, userPrompt: 'keep prompt marker', now: new Date('2026-06-01T10:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared' });
  await continueRun({ ...run, bindAgents: ['prepare=agent-prepare'], now: new Date('2026-06-01T10:02:00.000Z') });
  const beforeMove = snapshot(run.paths);

  const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T10:03:00.000Z') });
  assert.equal(listed.current.cursor, 'review');
  assert.deepEqual(listed.transitions.map((transition) => [transition.direction, transition.to.cursor]), [['backward', 'prepare']]);
  assert.doesNotMatch(JSON.stringify(listed), /agent-prepare|keep prompt marker|workflow-runner-token|history\.md|baton\.json/);

  const moved = await movePointer({
    ...run,
    transitionId: listed.transitions[0].id,
    now: new Date('2026-06-01T10:04:00.000Z'),
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
  assert.equal(afterMove.authority.status, 'needs_host_actions');

  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared again', now: new Date('2026-06-01T10:05:00.000Z') });
  assert.equal(snapshot(run.paths).baton.state.prepare.results[0].summary, 'prepared again');
  const stopped = await reportStop({
    ...run,
    stepId: 'prepare',
    json: JSON.stringify({ non_blocking_stop: { stop_id: '00000000-0000-4000-8000-000000000099', summary: 'Need a decision.', needed: 'Choose how to proceed.' } }),
    now: new Date('2026-06-01T10:06:00.000Z'),
  });
  assert.equal(stopped.reported, true);
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
  await movePointer({ ...run, transitionId: listed.transitions[0].id, now: new Date('2026-06-01T10:04:00.000Z') });
  const beforeRejected = snapshot(run.paths);

  await assert.rejects(
    () => movePointer({ ...run, transitionId: listed.transitions[0].id, now: new Date('2026-06-01T10:05:00.000Z') }),
    /stale, unavailable, or not a state-bearing predecessor/,
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
  assert.deepEqual(terminal.transitions.map((transition) => [transition.direction, transition.to.cursor]), [
    ['backward', 'finalize'],
    ['backward', 'review'],
    ['backward', 'prepare'],
  ]);
  const prepareMove = terminal.transitions.find((transition) => transition.to.cursor === 'prepare');
  assert.ok(prepareMove);
  const terminalMoved = await movePointer({
    ...terminalRun,
    transitionId: prepareMove.id,
    now: new Date('2026-06-01T10:06:00.000Z'),
  });
  assert.equal(terminalMoved.current.cursor, 'prepare');
  assert.equal(terminalMoved.current.status, 'running');
  assert.equal(snapshot(terminalRun.paths).authority.status, 'needs_host_actions');

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
