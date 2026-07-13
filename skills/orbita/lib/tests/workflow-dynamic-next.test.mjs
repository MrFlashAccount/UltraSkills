import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { runWorkflowRuntimeApi } from './helpers/workflow-runtime-api-client.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-dynamic-next-'));
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn markdown.\n');

function schemaDoc({ required = ['outcome'], properties = {} } = {}) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required,
    properties: {
      outcome: { const: 'ready' },
      artifacts: { type: 'array' },
      results: { type: 'array' },
      next: { enum: ['review_a', 'review_b', 'join'] },
      ...properties,
    },
    additionalProperties: false,
  };
}

const nonStringSchema = { anyOf: [{ type: 'null' }, { type: 'number' }, { type: 'boolean' }, { type: 'object' }, { type: 'array' }] };
const dynamicValueSchema = { anyOf: [{ enum: ['review_a'] }, nonStringSchema] };
const dynamicMatchValueSchema = { anyOf: [{ enum: ['ready'] }, nonStringSchema] };

const outputSchemas = {
  'base-output-schema.json': schemaDoc(),
  'ready-output-schema.json': schemaDoc({ properties: { outcome: { const: 'ready' } } }),
  'next-output-schema.json': schemaDoc({ required: ['outcome', 'next'], properties: { next: { enum: ['review_a', 'review_b'] } } }),
  'open-next-output-schema.json': schemaDoc({ required: ['outcome', 'next'], properties: { next: { anyOf: [{ enum: ['review_a'] }, { type: 'string' }] } } }),
  'next-unknown-output-schema.json': schemaDoc({ required: ['outcome', 'next'], properties: { next: { enum: ['review_a', 'missing'] } } }),
  'route-next-output-schema.json': schemaDoc({
    required: ['outcome', 'route'],
    properties: { route: { type: 'object', required: ['next'], properties: { next: { enum: ['review_a', 'review_b'] } }, additionalProperties: false } },
  }),
  'steps-next-output-schema.json': schemaDoc({
    required: ['outcome', 'steps'],
    properties: { steps: { type: 'object', required: ['next'], properties: { next: { enum: ['review_a', 'review_b'] } }, additionalProperties: false } },
  }),
  'selected-steps-output-schema.json': schemaDoc({
    required: ['outcome', 'selected_steps'],
    properties: { selected_steps: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: ['review_a', 'review_b'] } } },
  }),
  'dynamic-value-output-schema.json': schemaDoc({ required: ['outcome', 'dynamic_value'], properties: { dynamic_value: dynamicValueSchema } }),
  'dynamic-match-value-output-schema.json': schemaDoc({ required: ['outcome', 'dynamic_value'], properties: { dynamic_value: dynamicMatchValueSchema } }),
  'two-way-match-output-schema.json': schemaDoc({ required: ['outcome', 'status'], properties: { status: { enum: ['ready', 'retry'] } } }),
  'planning-draft-output-schema.json': schemaDoc({
    required: ['outcome', 'selected_reviewers', 'selected_reviewer', 'route'],
    properties: {
      selected_reviewers: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: ['review_a', 'review_b'] } },
      selected_reviewer: { enum: ['review_a', 'review_b'] },
      route: { enum: ['review'] },
    },
  }),
  'loop-route-output-schema.json': schemaDoc({
    required: ['outcome', 'route', 'limit_reason'],
    properties: {
      outcome: { const: 'ready' },
      route: { enum: ['fix', 'done', 'limit_reached'] },
      limit_reason: { enum: ['hard', 'soft'] },
    },
  }),
};

for (const [fileName, schema] of Object.entries(outputSchemas)) {
  writeFileSync(path.join(tempDir, fileName), `${JSON.stringify(schema, null, 2)}\n`);
}

function outputContract(schema = 'base-output-schema.json') {
  return { template: 'output.md', schema };
}

function schemaForNext(next) {
  if (next === '${{ output.next }}') return 'next-output-schema.json';
  if (next === '${{ output.route.next }}') return 'route-next-output-schema.json';
  if (next === '${{ output.steps.next }}') return 'steps-next-output-schema.json';
  if (next === '${{ output.selected_steps }}') return 'selected-steps-output-schema.json';
  if (next === '${{ output.dynamic_value }}') return 'dynamic-value-output-schema.json';
  return 'base-output-schema.json';
}

function workflow(next = '${{ output.next }}', selectorSchema = schemaForNext(next)) {
  return {
    name: 'dynamic-next-spec',
    version: 1,
    start: 'selector',
    done: 'done',
    steps: {
      selector: {
        name: 'Selector',
        kind: 'worker',
        input: { prompt: 'Select next.' },
        output: outputContract(selectorSchema),
        next,
      },
      planning_draft: { name: 'Planning draft', kind: 'worker', input: {}, output: outputContract('planning-draft-output-schema.json'), next: 'selector' },
      review_a: { name: 'Review A', kind: 'worker', input: {}, output: outputContract(), next: 'join' },
      review_b: { name: 'Review B', kind: 'worker', input: {}, output: outputContract(), next: 'join' },
      join: { name: 'Join', kind: 'worker', input: {}, output: outputContract(), next: 'done' },
      done: { name: 'Done', kind: 'done', input: { prompt: 'Done.' } },
    },
  };
}

function baton(overrides = {}) {
  return {
    cursor: 'selector',
    status: 'running',
    state: {
      artifacts: [],
      results: [],
      planning_draft: { selected_reviewers: ['review_a', 'review_b'], selected_reviewer: 'review_a' },
    },
    ...overrides,
  };
}

function writeJson(fileName, value) {
  const filePath = path.join(tempDir, fileName);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function runRuntime(label, mode, batonDoc, expectSuccess = true, workflowDoc = workflow(), workerOutput) {
  const batonPath = writeJson(`${label}-baton.json`, batonDoc);
  const workflowPath = writeJson(`${label}-workflow.json`, workflowDoc);
  const outputPath = workerOutput === undefined ? undefined : writeJson(`${label}-output.json`, workerOutput);
  const result = runWorkflowRuntimeApi({ mode, workflowPath, batonPath, outputPath });
  assert.equal(
    result.status === 0,
    expectSuccess,
    `${label} expected ${expectSuccess ? 'success' : 'failure'}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return expectSuccess ? JSON.parse(result.stdout) : result;
}

function runApply(label, batonDoc, workerOutput, expectSuccess = true, workflowDoc = workflow()) {
  return runRuntime(label, 'apply', batonDoc, expectSuccess, workflowDoc, workerOutput);
}

function runInspect(label, batonDoc, expectSuccess = true, workflowDoc = workflow()) {
  return runRuntime(label, 'inspect', batonDoc, expectSuccess, workflowDoc);
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

function loopWorkflow(overrides = {}) {
  return {
    name: 'loop-policy-spec',
    version: 1,
    start: 'fix',
    done: 'done',
    limit_reached: 'limit_reached',
    loopPolicies: {
      review_fix: {
        steps: ['review', 'fix'],
        entry: 'fix',
        boundary: 'review',
        maxIterations: 2,
        onLimit: {
          match: '${{ output.limit_reason }}',
          cases: { hard: 'limit_reached', soft: 'done' },
        },
      },
    },
    steps: {
      review: {
        name: 'Review',
        kind: 'worker',
        input: {},
        output: outputContract('loop-route-output-schema.json'),
        next: { match: '${{ output.route }}', cases: { fix: 'fix', done: 'done', limit_reached: 'limit_reached' } },
      },
      fix: { name: 'Fix', kind: 'worker', input: {}, output: outputContract(), next: 'review' },
      done: { name: 'Done', kind: 'done', input: { prompt: 'Done.' } },
      limit_reached: { name: 'Limit reached', kind: 'done', input: { prompt: 'Iteration limit reached.' } },
    },
    ...overrides,
  };
}

function loopBaton(overrides = {}) {
  return {
    cursor: 'fix',
    status: 'running',
    state: { artifacts: [], results: [] },
    ...overrides,
  };
}

test('dynamic output string routes to the selected existing step', () => {
  const response = runApply('output-string', baton(), { outcome: 'ready', next: 'review_a' });
  assert.equal(response.baton.cursor, 'review_a');
  assert.equal(response.steps[0].id, 'review_a');
});

test('dynamic nested output path routes to the selected existing step', () => {
  const response = runApply('nested-output-string', baton(), { outcome: 'ready', route: { next: 'review_b' } }, true, workflow('${{ output.route.next }}'));
  assert.equal(response.baton.cursor, 'review_b');
  assert.equal(response.steps[0].id, 'review_b');
});

test('dynamic output path can read a top-level steps object as ordinary worker output', () => {
  const response = runApply('steps-output-string', baton(), { outcome: 'ready', steps: { next: 'review_a' } }, true, workflow('${{ output.steps.next }}'));
  assert.equal(response.baton.cursor, 'review_a');
  assert.equal(response.steps[0].id, 'review_a');
});


test('loopPolicies count complete traversals, preserve early exits, and use the declared boundary exit at the exact limit', () => {
  const first = runApply('loop-fix-to-review-1', loopBaton(), { outcome: 'ready' }, true, loopWorkflow());
  assert.equal(first.baton.cursor, 'review');
  assert.deepEqual(first.baton.state.$loopProgress, { review_fix: 1 });

  const earlyExit = runApply('loop-early-exit', first.baton, { outcome: 'ready', route: 'done', limit_reason: 'soft' }, true, loopWorkflow());
  assert.equal(earlyExit.baton.cursor, 'done');
  assert.deepEqual(earlyExit.baton.state.$loopProgress, { review_fix: 1 });

  const repeat = runApply('loop-review-to-fix-2', first.baton, { outcome: 'ready', route: 'fix', limit_reason: 'hard' }, true, loopWorkflow());
  assert.equal(repeat.baton.cursor, 'fix');
  assert.deepEqual(repeat.baton.state.$loopProgress, { review_fix: 1 });

  const second = runApply('loop-fix-to-review-2', repeat.baton, { outcome: 'ready' }, true, loopWorkflow());
  assert.equal(second.baton.cursor, 'review');
  assert.deepEqual(second.baton.state.$loopProgress, { review_fix: 2 });

  const exhausted = runApply('loop-exhausted-at-boundary', second.baton, { outcome: 'ready', route: 'fix', limit_reason: 'hard' }, true, loopWorkflow());
  assert.equal(exhausted.baton.cursor, 'limit_reached');
  assert.equal(exhausted.baton.status, 'done');
  assert.deepEqual(exhausted.baton.state.$loopProgress, { review_fix: 2 });

});

test('output schema retries do not increment loop policy progress', () => {
  const reviewBaton = loopBaton({ cursor: 'review', state: { artifacts: [], results: [] } });
  const retry = runApply('loop-retry-no-progress', reviewBaton, { outcome: 'ready' }, true, loopWorkflow());
  assert.equal(retry.baton.cursor, 'review');
  assert.deepEqual(retry.baton.state.attempts, { 'review:output.schema': 1 });
  assert.equal(retry.baton.state.$loopProgress, undefined);

  const valid = runApply('loop-valid-after-retry', retry.baton, { outcome: 'ready', route: 'fix', limit_reason: 'hard' }, true, loopWorkflow());
  assert.equal(valid.baton.cursor, 'fix');
  assert.equal(valid.baton.state.$loopProgress, undefined);
});

test('dynamic input state path routes correctly', () => {
  const response = runApply('input-path', baton(), { outcome: 'ready' }, true, workflow('${{ input.planning_draft.selected_reviewer }}'));
  assert.deepEqual(response.steps.map((step) => step.id), ['review_a']);
});

test('dynamic next rejects missing paths and invalid resolved values', () => {
  assert.match(
    runApply('missing-output-path', baton(), { outcome: 'ready' }, false, workflow('${{ output.missing_next }}')).stderr,
    /has no schema-covered path \(path not found\)/,
  );
  assert.match(
    runApply('open-string-target-schema', baton(), { outcome: 'ready', next: 'review_a' }, false, workflow('${{ output.next }}', 'open-next-output-schema.json')).stderr,
    /next expression .* open string schema must be constrained with enum or const values/,
  );
  assert.match(
    runApply('empty-string', baton({ state: { ...baton().state, attempts: { 'selector:output.schema': 2 } } }), { outcome: 'ready', next: '' }, false).stderr,
    /output schema validation failed.*next must be equal to one of the allowed values/s,
  );

  for (const [label, dynamic_value] of [
    ['null-value', null],
    ['number-value', 7],
    ['object-value', { target: 'review_a' }],
    ['nested-array-value', ['review_a', ['review_b']]],
  ]) {
    assert.match(
      runApply(label, baton(), { outcome: 'ready', dynamic_value }, false, workflow('${{ output.dynamic_value }}')).stderr,
      /next expression .* schema allows non-string type/,
    );
  }
});



test('match/cases output path routes string target', () => {
  const matchWorkflow = workflow({ match: '${{ output.outcome }}', cases: { ready: 'review_b' } });
  const matched = runApply('match-cases-output-string', baton(), { outcome: 'ready' }, true, matchWorkflow);
  assert.equal(matched.baton.cursor, 'review_b');
});

test('match/cases input path routes target', () => {
  const matchWorkflow = workflow({ match: '${{ input.planning_draft.route }}', cases: { review: 'review_a' } });
  const matched = runApply(
    'match-cases-input-string',
    baton({ state: { artifacts: [], results: [], planning_draft: { selected_reviewers: ['review_a', 'review_b'], route: 'review' } } }),
    { outcome: 'ready' },
    true,
    matchWorkflow,
  );
  assert.equal(matched.baton.cursor, 'review_a');
});


test('match/cases rejects missing cases and non-string match results', () => {
  const matchWorkflow = workflow({ match: '${{ output.status }}', cases: { ready: 'review_b' } }, 'two-way-match-output-schema.json');
  assert.match(
    runApply('match-cases-missing-case', baton(), { outcome: 'ready', status: 'retry' }, false, matchWorkflow).stderr,
    /next\.cases is missing schema-declared case 'retry'/,
  );

  const openStringWorkflow = workflow({ match: '${{ output.next }}', cases: { review_a: 'review_b' } }, 'open-next-output-schema.json');
  assert.match(
    runApply('match-open-string-schema', baton(), { outcome: 'ready', next: 'review_a' }, false, openStringWorkflow).stderr,
    /next\.match expression .* open string schema must be constrained with enum or const values/,
  );

  const nonStringWorkflow = workflow({ match: '${{ output.dynamic_value }}', cases: { ready: 'review_b' } }, 'dynamic-match-value-output-schema.json');
  for (const [label, dynamic_value] of [
    ['match-null', null],
    ['match-number', 7],
    ['match-boolean', true],
    ['match-object', { outcome: 'ready' }],
    ['match-array', ['ready']],
  ]) {
    assert.match(
      runApply(label, baton(), { outcome: 'ready', dynamic_value }, false, nonStringWorkflow).stderr,
      /next\.match expression .* schema allows non-string type/,
    );
  }
});






test('match/cases rejects nested match/cases inside cases explicitly', () => {
  const workflowDoc = workflow({
    match: '${{ output.outcome }}',
    cases: { ready: { match: '${{ output.route.next }}', cases: { review: 'review_b' } } },
  });
  assert.match(
    runApply('nested-match-cases-case', baton(), { outcome: 'ready', route: { next: 'review' } }, false, workflowDoc).stderr,
    /workflow failed schema validation: nested match\/cases transitions are not supported at steps\.selector\.next\.cases\.ready/,
  );
});



test('old next.by/map is rejected while scalar static and direct dynamic next still work', () => {
  const literal = runApply('literal-next', baton(), { outcome: 'ready', next: 'review_a' }, true, workflow('review_a'));
  assert.equal(literal.baton.cursor, 'review_a');

  const directDynamic = runApply('direct-dynamic-next-still-works', baton(), { outcome: 'ready', next: 'review_a' });
  assert.equal(directDynamic.baton.cursor, 'review_a');

  const result = runApply('old-by-map-rejected', baton(), { outcome: 'ready' }, false, workflow({ by: 'outcome', map: { ready: 'review_b' } }));
  assert.match(result.stderr, /workflow failed schema validation/);
});
