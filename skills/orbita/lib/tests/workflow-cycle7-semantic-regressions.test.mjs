import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { Baton } from '../entities/Baton/index.mjs';
import { Step } from '../entities/Step/index.mjs';
import { Template } from '../entities/Template/index.mjs';
import { Workflow } from '../entities/Workflow/index.mjs';
import { assertBatonSchema } from '../file-contracts/baton/baton-schema.mjs';
import { assertWorkflowSchema } from '../file-contracts/workflow-document-schema.mjs';
import { applyOutputToBatonState } from '../runtime/baton-state.mjs';
import { compileWorkflowForRuntime } from '../runtime/compiled-workflow.mjs';
import { applyLoopPolicyTransition } from '../runtime/loop-policies.mjs';

function workflowDoc(overrides = {}) {
  return {
    name: 'cycle-seven',
    version: 1,
    start: 'worker',
    done: 'done',
    steps: {
      worker: { name: 'Worker', kind: 'worker', input: { role: 'backend' }, next: 'done' },
      done: { name: 'Done', kind: 'done' },
    },
    ...overrides,
  };
}

function batonDoc(overrides = {}) {
  return {
    cursor: 'worker',
    status: 'running',
    state: { artifacts: [], results: [] },
    ...overrides,
  };
}

test('compiled workflows own an immutable approved snapshot and content changes revalidate', () => {
  const source = workflowDoc();
  const allowedRoles = ['backend'];
  const compiled = compileWorkflowForRuntime(source, { allowedRoles });

  source.steps.worker.next = 'missing';
  assert.equal(compiled.steps.worker.next, 'done');
  assert.throws(() => { compiled.steps.worker.next = 'missing'; }, TypeError);

  allowedRoles[0] = 'frontend';
  assert.throws(
    () => compileWorkflowForRuntime(compiled, { allowedRoles }),
    /input\.role 'backend' is not an allowed role/,
  );
});

test('Step public APIs treat Baton entities and plain DTOs identically, including default output and loop progress', () => {
  const workflow = workflowDoc({
    steps: {
      worker: { name: 'Worker', kind: 'worker', next: 'worker' },
      done: { name: 'Done', kind: 'done' },
    },
    loopPolicies: { retry: { steps: ['worker'], maxIterations: 2, onLimit: 'done' } },
  });
  const plain = batonDoc({
    state: { artifacts: [], results: [], worker: { outcome: 'retry' }, $loopProgress: { retry: 1 } },
  });
  const entity = new Baton(plain);
  const step = new Step({ id: 'worker', step: workflow.steps.worker });

  assert.deepEqual(step.resolveInputs(entity), step.resolveInputs(plain));
  assert.deepEqual(step.resolveConcreteTargets(entity, workflow), step.resolveConcreteTargets(plain, workflow));
  assert.deepEqual(step.prepareRenderContext({ workflow, baton: entity }), step.prepareRenderContext({ workflow, baton: plain }));
  assert.deepEqual(step.applyOutput({ workflow, baton: entity }), step.applyOutput({ workflow, baton: plain }));
});

test('baton state application owns results, attempts, loop progress, and stored output', () => {
  const output = { outcome: 'ok', artifacts: [], results: [{ nested: { value: 1 } }] };
  const attempts = { worker: { count: 1 } };
  const loopProgress = { retry: 1 };
  const state = applyOutputToBatonState(batonDoc(), output, attempts, 'worker', { loopProgress });

  output.results[0].nested.value = 2;
  attempts.worker.count = 2;
  loopProgress.retry = 2;
  assert.equal(state.results[0].nested.value, 1);
  assert.equal(state.worker.results[0].nested.value, 1);
  assert.deepEqual(state.attempts, { worker: { count: 1 } });
  assert.deepEqual(state.$loopProgress, { retry: 1 });
});

test('entities deep-freeze owned snapshots and nested accessors return defensive clones', () => {
  const source = workflowDoc();
  const workflow = new Workflow(source);
  source.steps.worker.input.role = 'frontend';
  assert.equal(workflow.steps.worker.input.role, 'backend');
  assert.throws(() => { workflow.steps.worker.input.role = 'frontend'; }, TypeError);

  const baton = new Baton(batonDoc({ state: { artifacts: [], results: [], worker: { nested: { value: 1 } } }, requests: [{ stepId: 'worker', metadata: { value: 1 } }] }));
  const output = baton.outputFor('worker');
  const requests = baton.pendingRequests();
  output.nested.value = 2;
  requests[0].metadata.value = 2;
  assert.equal(baton.outputFor('worker').nested.value, 1);
  assert.equal(baton.pendingRequests()[0].metadata.value, 1);
});

test('loop limits and counters reject unsafe, unknown, and stale values at every boundary', () => {
  const workflow = workflowDoc({
    steps: {
      worker: { name: 'Worker', kind: 'worker', next: 'worker' },
      done: { name: 'Done', kind: 'done' },
    },
    loopPolicies: { retry: { steps: ['worker'], maxIterations: 2, onLimit: 'done' } },
  });
  assert.throws(() => assertWorkflowSchema({ ...workflow, loopPolicies: { retry: { ...workflow.loopPolicies.retry, maxIterations: Number.MAX_SAFE_INTEGER + 1 } } }), /workflow/);
  assert.throws(() => assertBatonSchema(batonDoc({ state: { artifacts: [], results: [], $loopProgress: { retry: Number.MAX_SAFE_INTEGER + 1 } } })), /baton/);
  assert.throws(() => new Baton(batonDoc({ state: { artifacts: [], results: [], $loopProgress: { stale: 1 } } })).validateAgainst(workflow), /does not identify a workflow loop policy/);
  assert.throws(() => new Baton(batonDoc({ state: { artifacts: [], results: [], $loopProgress: { retry: 3 } } })).validateAgainst(workflow), /must not exceed loopPolicy maxIterations 2/);
  assert.throws(
    () => applyLoopPolicyTransition({ workflow, baton: batonDoc({ state: { artifacts: [], results: [], $loopProgress: { stale: 1 } } }), stepId: 'worker', transition: { targetStepId: 'worker' } }),
    /unknown policy 'stale'/,
  );
});

test('inline Template userPrompt interpolation preserves replacement dollar sequences literally', () => {
  const prompt = '$$ $& $` $\' $1 $<name>';
  assert.equal(new Template({ content: 'before ${{ userPrompt }} after' }).render({ userPrompt: prompt }).prompt, `before ${prompt} after`);
});
