// Exercises durable per-transition feedback and selective target-step cleanup.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import {
  continueRun,
  listPointerTransitions,
  loadInstructions,
  movePointer,
  next,
  writeOutput,
} from './helpers/orbita-production-api.mjs';
import { registerWorkflowRunAtRoot } from '../persistence/run-state/workflow-runs.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { projectPointerTransitions, resolvePointerMove } from '../runner/pointer-transition-projection.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-runner-pointer-feedback-'));
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn JSON.\n');

const workflowDoc = {
  name: 'pointer-feedback-check',
  version: 1,
  start: 'prepare',
  done: 'done',
  steps: {
    prepare: { name: 'Prepare', kind: 'worker', input: { prompt: 'Prepare.' }, output: { template: 'output.md' }, next: 'review' },
    review: { name: 'Review', kind: 'worker', input: { prompt: 'Review.' }, output: { template: 'output.md' }, next: 'finalize' },
    finalize: { name: 'Finalize', kind: 'worker', input: { prompt: 'Finalize.' }, output: { template: 'output.md' }, next: 'done' },
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
  const runId = `workflow-runner-pointer-feedback-${process.pid}-${label}`;
  const paths = resolveRunPaths({ runId, workflowPath: workflow });
  rmSync(paths.runDir, { recursive: true, force: true });
  const claim = await registerWorkflowRunAtRoot({
    runId,
    workflowPath: workflow,
    claim: true,
    owner: 'pointer-feedback-test',
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

async function acceptCurrentWorkerOutput({ runId, workflowPath, paths, leaseToken, stepId, summary, now }) {
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

function batonSnapshot(paths) {
  return JSON.parse(readFileSync(paths.batonPath, 'utf8'));
}

test('pointer rollback feedback survives resume and clears only after the target step completes', async () => {
  const run = await createClaimedRun('lifecycle');
  await next({ ...run, now: new Date('2026-06-01T12:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared before rollback', now: new Date('2026-06-01T12:01:00.000Z') });
  await continueRun({ ...run, now: new Date('2026-06-01T12:02:00.000Z') });
  const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T12:03:00.000Z') });
  const feedback = 'The implementation requires a bounded retry path. Revise the preparation.';

  await assert.rejects(
    () => movePointer({ ...run, transitionId: listed.transitions[0].id, now: new Date('2026-06-01T12:03:30.000Z') }),
    /pointer transition feedback is required/,
  );
  await movePointer({ ...run, transitionId: listed.transitions[0].id, feedback, now: new Date('2026-06-01T12:04:00.000Z') });
  await next({ ...run, now: new Date('2026-06-01T12:05:00.000Z') });
  const instructions = await loadInstructions({ ...run, stepId: 'prepare', now: new Date('2026-06-01T12:06:00.000Z') });
  assert.match(instructions, /## Pointer rollback feedback/);
  assert.match(instructions, new RegExp(feedback.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared after rollback', now: new Date('2026-06-01T12:07:00.000Z') });
  assert.equal(batonSnapshot(run.paths).pointerTransitions[listed.transitions[0].id].feedback, feedback);
  await continueRun({ ...run, now: new Date('2026-06-01T12:08:00.000Z') });
  assert.equal(Object.hasOwn(batonSnapshot(run.paths), 'pointerTransitions'), false);
});

test('backend-to-architect-to-analyst rollback feedback unwinds without losing the architect obligation', async () => {
  const run = await createClaimedRun('nested');
  await next({ ...run, now: new Date('2026-06-01T13:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared', now: new Date('2026-06-01T13:01:00.000Z') });
  await continueRun({ ...run, now: new Date('2026-06-01T13:02:00.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'review', summary: 'reviewed', now: new Date('2026-06-01T13:03:00.000Z') });
  await continueRun({ ...run, now: new Date('2026-06-01T13:04:00.000Z') });

  const fromFinalize = await listPointerTransitions({ ...run, now: new Date('2026-06-01T13:05:00.000Z') });
  const architectMove = fromFinalize.transitions.find((transition) => transition.to.cursor === 'review');
  assert.ok(architectMove);
  const architectFeedback = 'Backend found an implementation constraint that the architect must address.';
  await movePointer({ ...run, transitionId: architectMove.id, feedback: architectFeedback, now: new Date('2026-06-01T13:06:00.000Z') });

  const fromArchitect = await listPointerTransitions({ ...run, now: new Date('2026-06-01T13:07:00.000Z') });
  const analystMove = fromArchitect.transitions.find((transition) => transition.to.cursor === 'prepare');
  assert.ok(analystMove);
  const analystFeedback = 'Architect needs the analyst to decide whether the edge case is required.';
  const moved = await movePointer({ ...run, transitionId: analystMove.id, feedback: analystFeedback, now: new Date('2026-06-01T13:08:00.000Z') });

  assert.deepEqual(moved.warnings, []);
  assert.deepEqual(batonSnapshot(run.paths).pointerTransitions, {
    [architectMove.id]: { targetStepId: 'review', feedback: architectFeedback },
    [analystMove.id]: { targetStepId: 'prepare', feedback: analystFeedback },
  });
  const analystInstructions = await loadInstructions({ ...run, stepId: 'prepare', now: new Date('2026-06-01T13:09:00.000Z') });
  assert.match(analystInstructions, new RegExp(analystFeedback));
  assert.doesNotMatch(analystInstructions, new RegExp(architectFeedback));

  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'analyst revised', now: new Date('2026-06-01T13:10:00.000Z') });
  await continueRun({ ...run, now: new Date('2026-06-01T13:11:00.000Z') });
  assert.deepEqual(batonSnapshot(run.paths).pointerTransitions, {
    [architectMove.id]: { targetStepId: 'review', feedback: architectFeedback },
  });
  const architectInstructions = await loadInstructions({ ...run, stepId: 'review', now: new Date('2026-06-01T13:12:00.000Z') });
  assert.match(architectInstructions, new RegExp(architectFeedback));
  assert.doesNotMatch(architectInstructions, new RegExp(analystFeedback));

  await acceptCurrentWorkerOutput({ ...run, stepId: 'review', summary: 'architect revised', now: new Date('2026-06-01T13:13:00.000Z') });
  await continueRun({ ...run, now: new Date('2026-06-01T13:14:00.000Z') });
  assert.equal(Object.hasOwn(batonSnapshot(run.paths), 'pointerTransitions'), false);
});

test('moving through an active transition id replaces only that entry and returns a warning', async () => {
  const run = await createClaimedRun('same-id-overwrite');
  await next({ ...run, now: new Date('2026-06-01T15:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared', now: new Date('2026-06-01T15:01:00.000Z') });
  await continueRun({ ...run, now: new Date('2026-06-01T15:02:00.000Z') });
  const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T15:03:00.000Z') });
  const transition = listed.transitions.find((candidate) => candidate.to.cursor === 'prepare');
  assert.ok(transition);

  const seeded = batonSnapshot(run.paths);
  seeded.pointerTransitions = {
    [transition.id]: { targetStepId: 'prepare', feedback: 'Old feedback.' },
    ptr_000000000000000000000000: { targetStepId: 'finalize', feedback: 'Keep unrelated feedback.' },
  };
  writeJson(run.paths.batonPath, seeded);

  const moved = await movePointer({
    ...run,
    transitionId: transition.id,
    feedback: 'Replacement feedback.',
    now: new Date('2026-06-01T15:04:00.000Z'),
  });

  assert.deepEqual(moved.warnings, [`overwrote active pointer transition '${transition.id}'`]);
  assert.deepEqual(batonSnapshot(run.paths).pointerTransitions, {
    [transition.id]: { targetStepId: 'prepare', feedback: 'Replacement feedback.' },
    ptr_000000000000000000000000: { targetStepId: 'finalize', feedback: 'Keep unrelated feedback.' },
  });
});

test('pointer feedback length uses schema-compatible Unicode character counting', () => {
  const baton = {
    cursor: 'review',
    status: 'running',
    state: { artifacts: [], results: [], prepare: workerOutput('prepared') },
  };
  const transition = projectPointerTransitions({ workflow: workflowDoc, baton }).transitions[0];
  const unicodeFeedback = '😀'.repeat(3_000);
  const resolved = resolvePointerMove({ workflow: workflowDoc, baton, transitionId: transition.id, feedback: unicodeFeedback });

  assert.equal(resolved.baton.pointerTransitions[transition.id].feedback, unicodeFeedback);
  assert.throws(() => resolvePointerMove({
    workflow: workflowDoc,
    baton,
    transitionId: transition.id,
    feedback: 'x'.repeat(4_097),
  }), /at most 4096 characters/);
});

test('pointer feedback reaches inline approval instructions and clears on approval completion', async () => {
  const producerSchema = 'pointer-approval-producer.schema.json';
  writeJson(path.join(tempDir, producerSchema), {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: { outcome: { const: 'ready' }, results: { type: 'array' } },
    additionalProperties: false,
  });
  const approvalWorkflow = {
    name: 'pointer-approval-feedback',
    version: 1,
    start: 'prepare',
    done: 'done',
    steps: {
      prepare: { name: 'Prepare', kind: 'worker', input: { prompt: 'Prepare approval.' }, output: { template: 'output.md', schema: producerSchema }, next: 'approve' },
      approve: {
        name: 'Approve',
        kind: 'approval',
        input: { summary: '${{ input.prepare.outcome }}' },
        next: { match: '${{ output.approval }}', cases: { approved: 'finalize', rejected: 'finalize' } },
      },
      finalize: { name: 'Finalize', kind: 'worker', input: { prompt: 'Finalize.' }, output: { template: 'output.md' }, next: 'done' },
      done: { name: 'Done', kind: 'done' },
    },
  };
  const run = await createClaimedRun('inline-approval', approvalWorkflow);
  await next({ ...run, now: new Date('2026-06-01T14:00:01.000Z') });
  await acceptCurrentWorkerOutput({ ...run, stepId: 'prepare', summary: 'prepared', now: new Date('2026-06-01T14:01:00.000Z') });
  await continueRun({ ...run, now: new Date('2026-06-01T14:02:00.000Z') });
  await writeOutput({ ...run, stepId: 'approve', json: JSON.stringify({ approval: 'approved' }), now: new Date('2026-06-01T14:03:00.000Z') });
  await continueRun({ ...run, now: new Date('2026-06-01T14:04:00.000Z') });

  const listed = await listPointerTransitions({ ...run, now: new Date('2026-06-01T14:05:00.000Z') });
  const approvalMove = listed.transitions.find((transition) => transition.to.cursor === 'approve');
  assert.ok(approvalMove);
  const feedback = 'Reconsider the approval using the backend constraint.';
  await movePointer({ ...run, transitionId: approvalMove.id, feedback, now: new Date('2026-06-01T14:06:00.000Z') });

  const resumed = await next({ ...run, now: new Date('2026-06-01T14:07:00.000Z') });
  assert.match(resumed.orchestratorInstruction, /## Pointer rollback feedback/);
  assert.match(resumed.orchestratorInstruction, new RegExp(feedback));
  const loaded = await loadInstructions({ ...run, stepId: 'approve', now: new Date('2026-06-01T14:08:00.000Z') });
  assert.match(loaded, new RegExp(feedback));

  await writeOutput({ ...run, stepId: 'approve', json: JSON.stringify({ approval: 'approved' }), now: new Date('2026-06-01T14:09:00.000Z') });
  assert.ok(batonSnapshot(run.paths).pointerTransitions[approvalMove.id]);
  await continueRun({ ...run, now: new Date('2026-06-01T14:10:00.000Z') });
  assert.equal(Object.hasOwn(batonSnapshot(run.paths), 'pointerTransitions'), false);
});
