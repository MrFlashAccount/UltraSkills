import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { assertWorkflowSchema } from '../file-contracts/workflow-document-schema.mjs';
import { applyWorkflowOutput } from '../runtime/workflow-output/apply.mjs';
import { renderWorkerInstructions } from '../runtime/render-worker-instructions.mjs';
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

const producerSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome', 'items'],
  properties: {
    outcome: { type: 'string' },
    items: {
      type: 'array',
      minItems: 1,
      items: true,
    },
  },
  additionalProperties: false,
};

const resources = {
  outputSchemas: {
    'worker.schema.json': workerSchema,
    'producer.schema.json': producerSchema,
  },
  templates: {
    'output.md': 'Return strict JSON.',
  },
};

function shardWorkflow(overrides = {}) {
  return {
    name: 'shard-fixture',
    version: 1,
    start: 'shard_work',
    done: 'done',
    steps: {
      producer: {
        name: 'Producer',
        kind: 'worker',
        output: { template: 'output.md', schema: 'producer.schema.json' },
        next: 'shard_work',
      },
      shard_work: {
        name: 'Shard work',
        kind: 'shard',
        max_parallel: 2,
        input: {
          shards: ['alpha', 7, true],
          prompt: 'Finalize shard work.',
        },
        output: { template: 'output.md', schema: 'worker.schema.json' },
        worker: {
          input: { prompt: 'Value=${{ shard.value }} index=${{ shard.index }} total=${{ shard.total }}' },
          output: { template: 'output.md', schema: 'worker.schema.json' },
        },
        next: 'done',
        ...(overrides.shard ?? {}),
      },
      done: { name: 'Done', kind: 'done' },
      ...(overrides.steps ?? {}),
    },
  };
}

function initialBaton(extraState = {}) {
  return {
    cursor: 'shard_work',
    status: 'running',
    state: { artifacts: [], results: [], ...extraState },
  };
}

test('shard accepts arbitrary literal JSON values and exposes only explicit interpolation', () => {
  const values = [null, 'SECRET_VALUE', 3, false, { name: 'api' }, ['nested']];
  const workflowDoc = shardWorkflow({
    shard: {
      max_parallel: 6,
      input: { shards: values, prompt: 'Finalize.' },
      worker: {
        input: { prompt: 'Process shard index ${{ shard.index }} of ${{ shard.total }}.' },
        output: { template: 'output.md', schema: 'worker.schema.json' },
      },
    },
  });

  assert.doesNotThrow(() => validateWorkflow({ workflowDTO: workflowDoc, outputSchemas: resources.outputSchemas }));
  const response = runNext({ workflowDoc, batonDoc: initialBaton(), resources });
  assert.deepEqual(response.baton.state.shards.shard_work.values, values);
  assert.equal(response.steps.length, values.length);
  assert.match(renderWorkerInstructions({ workflow: workflowDoc, baton: response.baton, entry: response.steps[0], resources }), /Process shard index 0 of 6/);
  assert.doesNotMatch(renderWorkerInstructions({ workflow: workflowDoc, baton: response.baton, entry: response.steps[1], resources }), /SECRET_VALUE/);
  assert.equal(Object.hasOwn(response.steps[0], 'compiledPrompt'), false);
  assert.equal(Object.hasOwn(response.steps[0].shard, 'value'), false);
});

test('shard dynamic input snapshots values and supports nested value interpolation', () => {
  const workflowDoc = shardWorkflow({
    shard: {
      input: { shards: '${{ input.producer.items }}', prompt: 'Finalize.' },
      worker: {
        input: { prompt: 'Package=${{ shard.value.name }} index=${{ shard.index }} total=${{ shard.total }}' },
        output: { template: 'output.md', schema: 'worker.schema.json' },
      },
    },
  });
  const baton = initialBaton({ producer: { outcome: 'ready', items: [{ name: 'api' }, { name: 'runtime' }, { name: 'cli' }] } });
  const first = runNext({ workflowDoc, batonDoc: baton, resources });
  assert.match(renderWorkerInstructions({ workflow: workflowDoc, baton: first.baton, entry: first.steps[0], resources }), /Package=api index=0 total=3/);
  assert.match(renderWorkerInstructions({ workflow: workflowDoc, baton: first.baton, entry: first.steps[1], resources }), /Package=runtime index=1 total=3/);

  const changedUpstream = structuredClone(first.baton);
  changedUpstream.state.producer.items = [{ name: 'changed-after-activation' }];
  const second = applyWorkflowOutput({
    workflowDoc,
    batonDoc: changedUpstream,
    outputValue: {
      steps: {
        shard_work__shard__1__0: { outcome: 'ready', summary: 'api done' },
        shard_work__shard__1__1: { outcome: 'ready', summary: 'runtime done' },
      },
    },
    resources,
  });
  assert.deepEqual(second.baton.state.shards.shard_work.values, [{ name: 'api' }, { name: 'runtime' }, { name: 'cli' }]);
  assert.deepEqual(second.steps.map((entry) => entry.id), ['shard_work__shard__1__2']);
  const renderedSecond = runNext({ workflowDoc, batonDoc: second.baton, resources });
  assert.match(renderWorkerInstructions({ workflow: workflowDoc, baton: renderedSecond.baton, entry: renderedSecond.steps[0], resources }), /Package=cli index=2 total=3/);
});

test('shard batches durably, retains bounded refs, then runs its genuine final worker', () => {
  const workflowDoc = shardWorkflow();
  const first = runNext({ workflowDoc, batonDoc: initialBaton(), resources });
  assert.equal(first.baton.cursor, 'shard_work');
  assert.deepEqual(first.steps.map((entry) => entry.id), ['shard_work__shard__1__0', 'shard_work__shard__1__1']);
  assert.equal(first.steps[0].parentStepId, 'shard_work');

  const second = applyWorkflowOutput({
    workflowDoc,
    batonDoc: first.baton,
    outputValue: {
      steps: {
        shard_work__shard__1__0: { outcome: 'ready', summary: 'alpha done' },
        shard_work__shard__1__1: { outcome: 'ready', summary: 'seven done' },
      },
    },
    resources,
  });
  assert.equal(second.baton.cursor, 'shard_work');
  assert.deepEqual(second.steps.map((entry) => entry.id), ['shard_work__shard__1__2']);
  assert.deepEqual(second.baton.state.shards.shard_work.accepted_outputs['0'], {
    index: 0,
    request_id: 'shard_work__shard__1__0',
    status: 'accepted',
    output_ref: { step_id: 'shard_work__shard__1__0' },
  });
  assert.equal(Object.hasOwn(second.baton.state.shards.shard_work.accepted_outputs['0'], 'output'), false);
  assert.equal(second.baton.state.shard_work__shard__1__0.summary, 'alpha done');

  const finalWorker = applyWorkflowOutput({
    workflowDoc,
    batonDoc: second.baton,
    outputValue: { steps: { shard_work__shard__1__2: { outcome: 'ready', summary: 'boolean done' } } },
    resources,
  });
  assert.equal(finalWorker.baton.state.shards.shard_work.phase, 'worker');
  assert.deepEqual(finalWorker.steps.map((entry) => entry.id), ['shard_work']);
  assert.equal(finalWorker.steps[0].step.kind, 'shard');
  assert.equal(finalWorker.steps[0].parentStepId, undefined);

  const done = applyWorkflowOutput({
    workflowDoc,
    batonDoc: finalWorker.baton,
    outputValue: { outcome: 'ready', summary: 'finalized' },
    resources,
  });
  assert.equal(done.baton.cursor, 'done');
  assert.equal(done.baton.state.shards.shard_work.phase, 'completed');
  assert.equal(done.baton.state.shard_work.summary, 'finalized');
});

test('shard partial batch retry durably accepts valid siblings and retries only the invalid request', () => {
  const workflowDoc = shardWorkflow();
  const first = runNext({ workflowDoc, batonDoc: initialBaton(), resources });
  const retry = applyWorkflowOutput({
    workflowDoc,
    batonDoc: first.baton,
    outputValue: {
      steps: {
        shard_work__shard__1__0: { outcome: 'ready', summary: 'alpha accepted once' },
        shard_work__shard__1__1: { summary: 'missing outcome' },
      },
    },
    resources,
  });

  assert.deepEqual(retry.steps.map((entry) => entry.id), ['shard_work__shard__1__1']);
  assert.deepEqual(retry.baton.state.shards.shard_work.current_requests, ['shard_work__shard__1__1']);
  assert.equal(retry.baton.state.shards.shard_work.shard_records[0].status, 'accepted');
  assert.equal(retry.baton.state.shards.shard_work.shard_records[1].status, 'pending');
  assert.equal(retry.baton.state.shards.shard_work.shard_records[2].status, 'pending');
  assert.deepEqual(retry.baton.state.shards.shard_work.accepted_outputs['0'].output_ref, {
    step_id: 'shard_work__shard__1__0',
  });
  assert.equal(retry.baton.state.shard_work__shard__1__0.summary, 'alpha accepted once');
  assert.equal(Object.hasOwn(retry.baton.state.shards.shard_work.accepted_outputs['0'], 'output'), false);
  assert.equal(retry.steps[0].shard.index, 1);
  assert.equal(retry.steps[0].shard.total, 3);

  const afterRetry = applyWorkflowOutput({
    workflowDoc,
    batonDoc: retry.baton,
    outputValue: {
      steps: {
        shard_work__shard__1__1: { outcome: 'ready', summary: 'seven accepted on retry' },
      },
    },
    resources,
  });
  assert.deepEqual(afterRetry.steps.map((entry) => entry.id), ['shard_work__shard__1__2']);
  assert.equal(afterRetry.baton.state.shards.shard_work.shard_records[0].status, 'accepted');
  assert.equal(afterRetry.baton.state.shards.shard_work.shard_records[1].status, 'accepted');
  assert.equal(afterRetry.baton.state.shard_work__shard__1__0.summary, 'alpha accepted once');

  const finalWorker = applyWorkflowOutput({
    workflowDoc,
    batonDoc: afterRetry.baton,
    outputValue: { steps: { shard_work__shard__1__2: { outcome: 'ready', summary: 'boolean done' } } },
    resources,
  });
  assert.equal(finalWorker.baton.state.shards.shard_work.phase, 'worker');
  assert.deepEqual(finalWorker.steps.map((entry) => entry.id), ['shard_work']);
});

test('shard rejects empty, numeric, and dynamically non-array inputs', () => {
  const empty = shardWorkflow({ shard: { input: { shards: [], prompt: 'Finalize.' } } });
  assert.throws(() => assertWorkflowSchema(empty), /must NOT have fewer than 1 items/);

  const numeric = shardWorkflow({ shard: { input: { shards: 3, prompt: 'Finalize.' } } });
  assert.throws(() => assertWorkflowSchema(numeric), /must match exactly one schema in oneOf/);

  const dynamic = shardWorkflow({ shard: { input: { shards: '${{ input.producer.items }}', prompt: 'Finalize.' } } });
  const invalidBaton = initialBaton({ producer: { outcome: 'ready', items: 'not-an-array' } });
  assert.throws(
    () => runNext({ workflowDoc: dynamic, batonDoc: invalidBaton, resources }),
    /input\.shards must resolve to a non-empty array/,
  );

  const unknownContext = shardWorkflow();
  unknownContext.steps.shard_work.worker.input.prompt = '${{ shard.unknown }}';
  assert.throws(
    () => validateWorkflow({ workflowDTO: unknownContext, outputSchemas: resources.outputSchemas }),
    /supports shard\.value, shard\.index, or shard\.total/,
  );
});
