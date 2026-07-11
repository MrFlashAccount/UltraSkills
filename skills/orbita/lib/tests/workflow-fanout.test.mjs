import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { assertWorkflowSchema } from '../file-contracts/workflow-document-schema.mjs';
import { applyWorkflowOutput } from '../runtime/workflow-output/apply.mjs';
import { runNext } from '../use-cases/RunNext.mjs';
import { validateWorkflow } from '../use-cases/ValidateWorkflow.mjs';

const workerSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome'],
  properties: {
    outcome: { type: 'string' },
    summary: { type: 'string' },
    artifacts: { type: 'array' },
    results: { type: 'array' },
  },
  additionalProperties: true,
};

const selectionSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome', 'branch_ids'],
  properties: {
    outcome: { type: 'string' },
    branch_ids: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { enum: ['branch_a', 'branch_b'] },
    },
  },
  additionalProperties: true,
};

const optionalSelectionSchema = {
  ...structuredClone(selectionSchema),
  required: ['outcome'],
};

const unionSelectionSchema = structuredClone(selectionSchema);
unionSelectionSchema.properties.branch_ids = {
  anyOf: [
    structuredClone(selectionSchema.properties.branch_ids),
    { type: 'string' },
  ],
};

const resources = {
  outputSchemas: {
    'worker.schema.json': workerSchema,
    'selection.schema.json': selectionSchema,
    'optional-selection.schema.json': optionalSelectionSchema,
    'union-selection.schema.json': unionSelectionSchema,
  },
  templates: {
    'output.md': 'Return strict JSON.',
  },
};

function fanoutWorkflow(overrides = {}) {
  return {
    name: 'fanout-fixture',
    version: 1,
    start: 'fanout',
    done: 'done',
    steps: {
      planning: {
        name: 'Planning',
        kind: 'worker',
        output: { template: 'output.md', schema: 'selection.schema.json' },
        next: 'fanout',
      },
      review: {
        name: 'Review selection',
        kind: 'worker',
        output: { template: 'output.md', schema: 'selection.schema.json' },
        next: 'fanout',
      },
      fanout: {
        name: 'Fanout owner',
        kind: 'fanout',
        max_parallel: 1,
        input: {
          branches: ['branch_a', 'branch_b'],
          prompt: 'A=${{ input.branch_a | default: "not selected" }} B=${{ input.branch_b | default: "not selected" }}',
        },
        output: { template: 'output.md', schema: 'worker.schema.json' },
        branches: {
          branch_a: {
            input: { prompt: 'Implement A.' },
            output: { template: 'output.md', schema: 'worker.schema.json' },
          },
          branch_b: {
            input: { prompt: 'Implement B.' },
            output: { template: 'output.md', schema: 'worker.schema.json' },
          },
        },
        next: 'done',
        ...(overrides.fanout ?? {}),
      },
      done: { name: 'Done', kind: 'done' },
      ...(overrides.steps ?? {}),
    },
    ...overrides.root,
  };
}

function initialBaton(extraState = {}) {
  return {
    cursor: 'fanout',
    status: 'running',
    state: { artifacts: [], results: [], ...extraState },
  };
}

test('scalar transition into fanout materializes branch requests through the owner cursor', () => {
  const workflowDoc = fanoutWorkflow({
    fanout: { input: { branches: '${{ input.planning.branch_ids }}', prompt: 'Aggregate selected branches.' } },
  });
  const response = applyWorkflowOutput({
    workflowDoc,
    batonDoc: {
      cursor: 'planning',
      status: 'running',
      state: { artifacts: [], results: [] },
    },
    outputValue: { outcome: 'ready', branch_ids: ['branch_a'] },
    resources,
  });

  assert.equal(response.baton.cursor, 'fanout');
  assert.equal(response.baton.state.fanouts.fanout.phase, 'branches');
  assert.deepEqual(response.steps.map((step) => step.id), ['fanout__fanout__1__branch_a']);
});

test('fanout schema and semantics accept owner/branch workers and reject branch collisions or control fields', () => {
  assert.deepEqual(validateWorkflow({ workflowDTO: fanoutWorkflow(), outputSchemas: resources.outputSchemas }).toJSON(), {
    ok: true,
    workflow: 'fanout-fixture',
    steps: 4,
  });

  const collision = fanoutWorkflow({
    fanout: {
      input: { branches: ['planning'] },
      branches: {
        planning: {
          input: { prompt: 'Invalid collision.' },
          output: { template: 'output.md', schema: 'worker.schema.json' },
        },
      },
    },
  });
  assert.throws(
    () => validateWorkflow({ workflowDTO: collision, outputSchemas: resources.outputSchemas }),
    /fanout branch id 'planning' collides with a workflow step id/,
  );

  const branchWithNext = fanoutWorkflow();
  branchWithNext.steps.fanout.branches.branch_a.next = 'done';
  assert.throws(() => assertWorkflowSchema(branchWithNext), /must NOT have additional properties/);

  const branchWithKind = fanoutWorkflow();
  branchWithKind.steps.fanout.branches.branch_a.kind = 'worker';
  assert.throws(() => assertWorkflowSchema(branchWithKind), /must NOT have additional properties/);
});

test('fanout input.branches supports dynamic and first-of selectors', () => {
  const workflow = fanoutWorkflow({
    fanout: {
      input: {
        branches: {
          first_of: ['${{ input.review.branch_ids }}', '${{ input.planning.branch_ids }}'],
        },
        prompt: 'Aggregate selected branches.',
      },
    },
  });
  assert.doesNotThrow(() => validateWorkflow({ workflowDTO: workflow, outputSchemas: resources.outputSchemas }));

  workflow.steps.review.output.schema = 'optional-selection.schema.json';
  assert.doesNotThrow(() => validateWorkflow({ workflowDTO: workflow, outputSchemas: resources.outputSchemas }));
});

test('fanout dynamic selector requires its schema path and rejects non-array union variants', () => {
  const optionalPath = fanoutWorkflow({
    fanout: { input: { branches: '${{ input.planning.branch_ids }}', prompt: 'Aggregate selected branches.' } },
  });
  optionalPath.steps.planning.output.schema = 'optional-selection.schema.json';
  assert.throws(
    () => validateWorkflow({ workflowDTO: optionalPath, outputSchemas: resources.outputSchemas }),
    /must reference a required output\.schema path/,
  );

  const nonArrayVariant = fanoutWorkflow({
    fanout: { input: { branches: '${{ input.planning.branch_ids }}', prompt: 'Aggregate selected branches.' } },
  });
  nonArrayVariant.steps.planning.output.schema = 'union-selection.schema.json';
  assert.throws(
    () => validateWorkflow({ workflowDTO: nonArrayVariant, outputSchemas: resources.outputSchemas }),
    /must resolve only to array schemas/,
  );
});

test('fanout keeps owner cursor through branch batches, then runs the genuine owner worker', () => {
  const workflowDoc = fanoutWorkflow();
  const first = runNext({ workflowDoc, batonDoc: initialBaton(), resources });
  assert.equal(first.baton.cursor, 'fanout');
  assert.equal(first.baton.state.fanouts.fanout.activation, 1);
  assert.equal(first.baton.state.fanouts.fanout.phase, 'branches');
  assert.deepEqual(first.steps.map((step) => step.id), ['fanout__fanout__1__branch_a']);
  assert.equal(first.steps[0].ownerStepId, 'fanout');
  assert.equal(first.steps[0].fanout.branch_id, 'branch_a');

  const second = applyWorkflowOutput({
    workflowDoc,
    batonDoc: first.baton,
    outputValue: { steps: { fanout__fanout__1__branch_a: { outcome: 'implemented', summary: 'A done' } } },
    resources,
  });
  assert.equal(second.baton.cursor, 'fanout');
  assert.deepEqual(second.steps.map((step) => step.id), ['fanout__fanout__1__branch_b']);
  assert.equal(second.baton.state.branch_a.summary, 'A done');
  assert.deepEqual(second.baton.state.fanouts.fanout.accepted_outputs.branch_a.output_ref, { step_id: 'branch_a' });
  assert.equal(Object.hasOwn(second.baton.state, 'fanout__fanout__1__branch_a'), false);

  const owner = applyWorkflowOutput({
    workflowDoc,
    batonDoc: second.baton,
    outputValue: { steps: { fanout__fanout__1__branch_b: { outcome: 'implemented', summary: 'B done' } } },
    resources,
  });
  assert.equal(owner.baton.cursor, 'fanout');
  assert.equal(owner.baton.state.fanouts.fanout.phase, 'owner');
  assert.deepEqual(owner.steps.map((step) => step.id), ['fanout']);
  assert.equal(owner.steps[0].ownerStepId, undefined);
  assert.equal(owner.steps[0].step.kind, 'fanout');

  const done = applyWorkflowOutput({
    workflowDoc,
    batonDoc: owner.baton,
    outputValue: { outcome: 'ready' },
    resources,
  });
  assert.equal(done.baton.cursor, 'done');
  assert.equal(done.baton.status, 'done');
  assert.equal(done.baton.state.fanouts.fanout.phase, 'completed');
  assert.equal(done.baton.state.fanout.outcome, 'ready');
});

test('fanout partial batch retry durably accepts valid siblings and retries only the invalid branch', () => {
  const workflowDoc = fanoutWorkflow({ fanout: { max_parallel: 2 } });
  const first = runNext({ workflowDoc, batonDoc: initialBaton(), resources });
  const retry = applyWorkflowOutput({
    workflowDoc,
    batonDoc: first.baton,
    outputValue: {
      steps: {
        fanout__fanout__1__branch_a: { outcome: 'implemented', summary: 'A accepted once' },
        fanout__fanout__1__branch_b: { summary: 'missing outcome' },
      },
    },
    resources,
  });

  assert.deepEqual(retry.steps.map((entry) => entry.id), ['fanout__fanout__1__branch_b']);
  assert.deepEqual(retry.baton.state.fanouts.fanout.current_requests, ['fanout__fanout__1__branch_b']);
  assert.equal(retry.baton.state.fanouts.fanout.branch_records[0].status, 'accepted');
  assert.equal(retry.baton.state.fanouts.fanout.branch_records[1].status, 'pending');
  assert.equal(retry.baton.state.branch_a.summary, 'A accepted once');
  assert.deepEqual(retry.baton.state.fanouts.fanout.accepted_outputs.branch_a.output_ref, { step_id: 'branch_a' });

  const owner = applyWorkflowOutput({
    workflowDoc,
    batonDoc: retry.baton,
    outputValue: {
      steps: {
        fanout__fanout__1__branch_b: { outcome: 'implemented', summary: 'B accepted on retry' },
      },
    },
    resources,
  });
  assert.equal(owner.baton.state.fanouts.fanout.phase, 'owner');
  assert.deepEqual(owner.steps.map((entry) => entry.id), ['fanout']);
  assert.equal(owner.baton.state.branch_a.summary, 'A accepted once');
});

test('fanout freezes one activation selection and hides stale unselected branch output from owner prompt', () => {
  const workflowDoc = fanoutWorkflow({
    fanout: {
      max_parallel: 2,
      input: {
        branches: '${{ input.planning.branch_ids }}',
        prompt: 'A=${{ input.branch_a | default: "not selected" }} B=${{ input.branch_b | default: "not selected" }}',
      },
    },
  });
  const baton = initialBaton({
    planning: { outcome: 'ready', branch_ids: ['branch_a'] },
    branch_b: { outcome: 'implemented', summary: 'STALE_BRANCH_B_VALUE' },
  });
  const first = runNext({ workflowDoc, batonDoc: baton, resources });
  assert.deepEqual(first.baton.state.fanouts.fanout.selected_branch_ids, ['branch_a']);

  const ownerResponse = applyWorkflowOutput({
    workflowDoc,
    batonDoc: first.baton,
    outputValue: { steps: { fanout__fanout__1__branch_a: { outcome: 'implemented', summary: 'CURRENT_BRANCH_A_VALUE' } } },
    resources,
  });
  const renderedOwner = runNext({ workflowDoc, batonDoc: ownerResponse.baton, resources });
  assert.match(renderedOwner.steps[0].compiledPrompt.prompt, /CURRENT_BRANCH_A_VALUE/);
  assert.doesNotMatch(renderedOwner.steps[0].compiledPrompt.prompt, /STALE_BRANCH_B_VALUE/);
  assert.match(renderedOwner.steps[0].compiledPrompt.prompt, /not selected/);
});
