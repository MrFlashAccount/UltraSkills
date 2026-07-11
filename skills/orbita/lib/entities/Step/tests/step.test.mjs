import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { assertNoNestedMatchCasesTarget, isDynamicTransitionNext, normalizeTransitionNext } from '../../../runtime/transition-next.mjs';
import { Step, resolveTransition } from '../index.mjs';

const workflow = {
  name: 'step-fixture',
  version: 1,
  start: 'producer',
  done: 'done',
  steps: {
    producer: {
      name: 'Producer',
      kind: 'worker',
      input: {},
      output: { schema: 'producer.schema.json' },
      next: { match: '${{ output.route }}', cases: { direct: 'done', split: 'branch_a' } },
    },
    dynamic: { name: 'Dynamic', kind: 'worker', input: {}, next: '${{ input.seed.next }}' },
    approval: { name: 'Approval', kind: 'approval', next: 'done' },
    branch_a: { name: 'Branch A', kind: 'worker', next: 'join' },
    branch_b: { name: 'Branch B', kind: 'worker', next: 'join' },
    join: { name: 'Join', kind: 'worker', input: {}, next: 'done' },
    done: { name: 'Done', kind: 'done' },
  },
};

const baton = {
  cursor: 'producer',
  status: 'running',
  state: { seed: { next: 'done' }, artifacts: [], results: [] },
};

test('transition descriptors classify static, dynamic, and match next values', () => {
  assert.equal(normalizeTransitionNext('done').kind, 'static-target');
  assert.equal(normalizeTransitionNext('${{ output.next }}').kind, 'dynamic-target');
  assert.equal(normalizeTransitionNext({ match: '${{ output.route }}', cases: { ok: 'done' } }).kind, 'match-cases');
  assert.equal(isDynamicTransitionNext({ match: '${{ output.route }}', cases: { ok: 'done' } }), true);
  assert.throws(() => normalizeTransitionNext(['branch_a', 'branch_b']), /must be one scalar transition/);
});

test('resolveTransition resolves match/cases targets and validates worker output shape', () => {
  assert.deepEqual(resolveTransition({ workflow, baton, stepId: 'producer', step: workflow.steps.producer, output: { outcome: 'ok', route: 'direct' } }), {
    targetStepId: 'done',
  });
  assert.deepEqual(resolveTransition({ workflow, baton, stepId: 'producer', step: workflow.steps.producer, output: { outcome: 'ok', route: 'split' } }), {
    targetStepId: 'branch_a',
  });

  assert.throws(
    () => resolveTransition({ workflow, baton, stepId: 'producer', step: workflow.steps.producer, output: { approval: 'yes', route: 'direct' } }),
    /worker cursor 'producer' must use outcome, not approval/,
  );
});

test('Step resolves dynamic transition input and concrete targets', () => {
  const dynamicStep = new Step({ id: 'dynamic', step: workflow.steps.dynamic });

  assert.deepEqual(dynamicStep.resolveInputs(baton), { seed: { next: 'done' } });
  assert.deepEqual(dynamicStep.resolveConcreteTargets(baton, workflow, { outcome: 'ok' }), { targetStepId: 'done' });
});

test('Step.applyOutput updates cursor/status and stores step output by step id', () => {
  const step = new Step({ id: 'producer', step: workflow.steps.producer });
  const result = step.applyOutput({ baton, workflow, output: { outcome: 'ok', route: 'direct' }, attempts: { producer: 1 } });

  assert.equal(result.targetStepId, 'done');
  assert.equal(result.baton.cursor, 'done');
  assert.equal(result.baton.status, 'done');
  assert.deepEqual(result.baton.state.producer, { outcome: 'ok', route: 'direct' });
  assert.deepEqual(result.baton.state.attempts, { producer: 1 });
});

test('transition helpers reject nested match/cases', () => {
  assert.throws(
    () => assertNoNestedMatchCasesTarget({ match: '${{ output.route }}', cases: { ok: 'done' } }, 'next.cases.ok'),
    /nested match\/cases transitions are not supported at next\.cases\.ok/,
  );
});
