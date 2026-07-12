import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { projectPointerTransitions } from '../runner/pointer-transition-projection.mjs';

function step(next, kind = 'worker') {
  return {
    name: `${kind} step`,
    kind,
    ...(next === undefined ? {} : { next }),
  };
}

function workflow(steps, start = Object.keys(steps)[0]) {
  return {
    name: 'pointer-matrix',
    version: 1,
    start,
    done: 'done',
    steps: {
      ...steps,
      ...(steps.done ? {} : { done: step(undefined, 'done') }),
    },
  };
}

function linear(...stepIds) {
  const steps = {};
  for (let index = 0; index < stepIds.length; index += 1) {
    steps[stepIds[index]] = step(stepIds[index + 1] ?? 'done');
  }
  return workflow(steps, stepIds[0]);
}

function output(extra = {}) {
  return { outcome: 'ready', ...extra };
}

function state(entries = {}) {
  return { artifacts: [], results: [], ...entries };
}

function baton(cursor, entries = {}, status = cursor === 'done' ? 'done' : 'running') {
  return { cursor, status, state: state(entries) };
}

const branchWorkflow = workflow({
  start: step('decide'),
  decide: step({ match: '${{ output.route }}', cases: { left: 'left', right: 'right' } }),
  left: step('done'),
  right: step('done'),
}, 'start');

const cycleWorkflow = workflow({
  a: step('b'),
  b: step('c'),
  c: step('a'),
}, 'a');

const scenarios = [
  {
    name: '01 start cursor has no rollback target',
    workflow: linear('a', 'b'),
    baton: baton('a'),
    expected: [],
  },
  {
    name: '02 middle cursor exposes one stateful predecessor',
    workflow: linear('a', 'b'),
    baton: baton('b', { a: output() }),
    expected: ['a'],
  },
  {
    name: '03 terminal cursor exposes the complete linear predecessor chain',
    workflow: linear('a', 'b', 'c'),
    baton: baton('done', { a: output(), b: output(), c: output() }),
    expected: ['c', 'b', 'a'],
  },
  {
    name: '04 rewind excludes retained downstream linear state',
    workflow: linear('a', 'b', 'c'),
    baton: baton('b', { a: output(), b: output(), c: output() }),
    expected: ['a'],
  },
  {
    name: '05 missing immediate predecessor breaks the rollback chain',
    workflow: linear('a', 'b', 'c'),
    baton: baton('c', { a: output(), c: output() }),
    expected: [],
  },
  {
    name: '06 unknown baton keys are not pointer targets',
    workflow: linear('a', 'b'),
    baton: baton('b', { a: output(), ghost: output() }),
    expected: ['a'],
  },
  {
    name: '07 workflow steps without baton state are not pointer targets',
    workflow: linear('a', 'b', 'c'),
    baton: baton('c', { b: output() }),
    expected: ['b'],
  },
  {
    name: '08 approval output can identify a predecessor',
    workflow: workflow({ approve: step('work', 'approval'), work: step('done') }, 'approve'),
    baton: baton('work', { approve: { approval: 'approved' } }),
    expected: ['approve'],
  },
  {
    name: '09 current cursor state is never returned as its own target',
    workflow: linear('a', 'b'),
    baton: baton('b', { b: output() }),
    expected: [],
  },
  {
    name: '10 terminal state key is ignored while its predecessor remains available',
    workflow: linear('a'),
    baton: baton('done', { a: output(), done: output() }),
    expected: ['a'],
  },
  {
    name: '11 selected left branch excludes stale right branch state',
    workflow: branchWorkflow,
    baton: baton('left', { start: output(), decide: output({ route: 'left' }), right: output() }),
    expected: ['decide', 'start'],
  },
  {
    name: '12 selected right branch excludes stale left branch state',
    workflow: branchWorkflow,
    baton: baton('right', { start: output(), decide: output({ route: 'right' }), left: output() }),
    expected: ['decide', 'start'],
  },
  {
    name: '13 changed branch state follows the new target',
    workflow: branchWorkflow,
    baton: baton('right', { start: output(), decide: output({ route: 'right' }), left: output(), right: output() }),
    expected: ['decide', 'start'],
  },
  {
    name: '14 rewind to the decision excludes both downstream branches',
    workflow: branchWorkflow,
    baton: baton('decide', { start: output(), decide: output({ route: 'right' }), left: output(), right: output() }),
    expected: ['start'],
  },
  {
    name: '15 dynamic target uses the saved output value',
    workflow: workflow({ start: step('route'), route: step('${{ output.target }}'), x: step('done'), y: step('done') }, 'start'),
    baton: baton('y', { start: output(), route: output({ target: 'y' }), x: output() }),
    expected: ['route', 'start'],
  },
  {
    name: '16 converged stateful branches are both valid predecessors',
    workflow: workflow({
      start: step('decide'),
      decide: step({ match: '${{ output.route }}', cases: { left: 'left', right: 'right' } }),
      left: step('merge'),
      right: step('merge'),
      merge: step('done'),
    }, 'start'),
    baton: baton('merge', { start: output(), decide: output({ route: 'left' }), left: output(), right: output() }),
    expected: ['left', 'right', 'decide', 'start'],
  },
  {
    name: '17 two-step cycle returns the other stateful step once',
    workflow: workflow({ a: step('b'), b: step('a') }, 'a'),
    baton: baton('b', { a: output(), b: output() }),
    expected: ['a'],
  },
  {
    name: '18 three-step cycle returns all other stateful steps once',
    workflow: cycleWorkflow,
    baton: baton('c', { a: output(), b: output(), c: output() }),
    expected: ['b', 'a'],
  },
  {
    name: '19 cycle traversal works from a different current cursor',
    workflow: cycleWorkflow,
    baton: baton('a', { a: output(), b: output(), c: output() }),
    expected: ['c', 'b'],
  },
  {
    name: '20 cycle includes its stateful entry predecessor',
    workflow: workflow({ entry: step('a'), a: step('b'), b: step('a') }, 'entry'),
    baton: baton('b', { entry: output(), a: output(), b: output() }),
    expected: ['a', 'entry'],
  },
  {
    name: '21 cycle exit exposes the resolved cycle chain at terminal',
    workflow: workflow({
      a: step('b'),
      b: step({ match: '${{ output.route }}', cases: { loop: 'a', exit: 'done' } }),
    }, 'a'),
    baton: baton('done', { a: output(), b: output({ route: 'exit' }) }),
    expected: ['b', 'a'],
  },
  {
    name: '22 fanout owner is a target while branch request state is ignored',
    workflow: workflow({ prepare: step('review'), review: step('done', 'fanout') }, 'prepare'),
    baton: baton('done', { prepare: output(), review: output(), 'review__fanout__1__backend': output() }),
    expected: ['review', 'prepare'],
  },
  {
    name: '23 shard owner is a target while shard request state is ignored',
    workflow: workflow({ prepare: step('build'), build: step('done', 'shard') }, 'prepare'),
    baton: baton('done', { prepare: output(), build: output(), 'build__shard__1__0': output() }),
    expected: ['build', 'prepare'],
  },
  {
    name: '24 rewind through fanout to shard excludes current and internal downstream state',
    workflow: workflow({ research: step('review'), review: step('build', 'fanout'), build: step('done', 'shard') }, 'research'),
    baton: baton('build', {
      research: output(),
      review: output(),
      build: output(),
      'review__fanout__1__backend': output(),
      'build__shard__1__0': output(),
    }),
    expected: ['review', 'research'],
  },
];

assert.equal(scenarios.length, 24);

for (const scenario of scenarios) {
  test(`pointer transition matrix: ${scenario.name}`, () => {
    const projected = projectPointerTransitions({ workflow: scenario.workflow, baton: scenario.baton });
    const targets = projected.transitions.map((transition) => transition.to.cursor);

    assert.deepEqual(targets, scenario.expected);
    assert.equal(projected.transitions.every((transition) => transition.direction === 'backward'), true);
    assert.equal(projected.transitions.some((transition) => transition.to.cursor === scenario.baton.cursor), false);
  });
}
