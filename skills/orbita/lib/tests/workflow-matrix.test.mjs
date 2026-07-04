import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { validateWorkflow } from '../use-cases/ValidateWorkflow.mjs';
import { runNext } from '../use-cases/RunNext.mjs';
import { applyWorkflowOutput } from '../use-cases/ApplyWorkflowOutput.mjs';

const outputSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome'],
  properties: {
    outcome: { enum: ['ready', 'blocked'] },
    summary: { type: 'string' },
    artifacts: { type: 'array' },
    results: { type: 'array' },
  },
  additionalProperties: true,
};

const producerSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome', 'units'],
  properties: {
    outcome: { enum: ['ready'] },
    units: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['unit', 'title'],
        properties: {
          unit: { type: 'string' },
          title: { type: 'string' },
          secret: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: false,
};

const resources = {
  outputSchemas: {
    'unit-output.schema.json': outputSchema,
    'producer-output.schema.json': producerSchema,
  },
  templates: {
    'output.md': 'Return strict JSON.',
  },
};

function matrixWorkflow(overrides = {}) {
  return {
    name: 'matrix-fixture',
    version: 1,
    start: 'fanout',
    done: 'done',
    steps: {
      fanout: {
        name: 'Fan out units',
        kind: 'matrix',
        source: {
          items: [
            { id: 'unit_a', context: { title: 'A', secret: 'not projected unless authored safe' } },
            { id: 'unit_b', context: { title: 'B' } },
            { id: 'unit_c', context: { title: 'C' } },
          ],
        },
        max_parallel: 2,
        max_attempts: 2,
        worker: {
          input: { prompt: 'Handle one unit.' },
          output: { template: 'output.md', schema: 'unit-output.schema.json' },
        },
        next: 'done',
        ...(overrides.fanout ?? {}),
      },
      producer: {
        name: 'Producer',
        kind: 'worker',
        output: { template: 'output.md', schema: 'producer-output.schema.json' },
        next: 'fanout',
      },
      done: { name: 'Done', kind: 'done' },
      ...(overrides.steps ?? {}),
    },
    ...overrides.root,
  };
}

const emptyBaton = { cursor: 'fanout', status: 'running', state: { artifacts: [], results: [] } };

test('matrix validation accepts static matrix and rejects unsafe or duplicate unit ids', () => {
  assert.deepEqual(validateWorkflow({ workflowDTO: matrixWorkflow(), outputSchemas: resources.outputSchemas }).toJSON(), {
    ok: true,
    workflow: 'matrix-fixture',
    steps: 3,
  });

  assert.throws(
    () => validateWorkflow({
      workflowDTO: matrixWorkflow({ fanout: { source: { items: [{ id: 'bad/id' }] } } }),
      outputSchemas: resources.outputSchemas,
    }),
    /must match pattern/,
  );

  assert.throws(
    () => validateWorkflow({
      workflowDTO: matrixWorkflow({ fanout: { source: { items: [{ id: 'api.v1' }] } } }),
      outputSchemas: resources.outputSchemas,
    }),
    /must match pattern/,
  );

  assert.throws(
    () => validateWorkflow({
      workflowDTO: matrixWorkflow({ fanout: { source: { items: [{ id: 'same' }, { id: 'same' }] } } }),
      outputSchemas: resources.outputSchemas,
    }),
    /duplicate matrix unit id 'same'/,
  );

  assert.throws(
    () => validateWorkflow({
      workflowDTO: matrixWorkflow({ fanout: { source: { items: [{ id: 'optional_unit', required: false }] } } }),
      outputSchemas: resources.outputSchemas,
    }),
    /must NOT have additional properties/,
  );
});

test('matrix semantic validation rejects unsupported v1 authoring shapes', () => {
  assert.throws(
    () => validateWorkflow({
      workflowDTO: matrixWorkflow({ fanout: { source: { from: '${{ output.units }}' } } }),
      outputSchemas: resources.outputSchemas,
    }),
    /matrix\.source\.from must use input\.\* selector/,
  );

  assert.throws(
    () => validateWorkflow({
      workflowDTO: matrixWorkflow({ fanout: { next: '${{ output.route }}' } }),
      outputSchemas: resources.outputSchemas,
    }),
    /matrix next must be a static step id/,
  );

  assert.throws(
    () => validateWorkflow({
      workflowDTO: matrixWorkflow({
        fanout: {
          worker: {
            kind: 'matrix',
            input: { prompt: 'Nested matrix must not be accepted.' },
            output: { template: 'output.md', schema: 'unit-output.schema.json' },
          },
        },
      }),
      outputSchemas: resources.outputSchemas,
    }),
    /must NOT have additional properties/,
  );

  assert.throws(
    () => validateWorkflow({
      workflowDTO: matrixWorkflow({
        root: { start: 'prepare' },
        fanout: { next: 'join' },
        steps: {
          prepare: {
            name: 'Prepare',
            kind: 'worker',
            output: { template: 'output.md', schema: 'unit-output.schema.json' },
            next: ['fanout', 'other_review'],
          },
          other_review: {
            name: 'Other review',
            kind: 'worker',
            output: { template: 'output.md', schema: 'unit-output.schema.json' },
            next: 'join',
          },
          join: {
            name: 'Join',
            kind: 'worker',
            output: { template: 'output.md', schema: 'unit-output.schema.json' },
            next: 'done',
          },
        },
      }),
      outputSchemas: resources.outputSchemas,
    }),
    /cannot fan out to matrix step 'fanout'/,
  );
});

test('matrix runtime keeps owner cursor and advances only after computed join proof', () => {
  const workflowDoc = matrixWorkflow();
  const first = runNext({ workflowDoc, batonDoc: emptyBaton, resources });
  assert.equal(first.baton.cursor, 'fanout');
  assert.deepEqual(first.steps.map((step) => step.id), ['fanout__matrix__unit_a', 'fanout__matrix__unit_b']);
  assert.deepEqual(first.baton.state.matrix.fanout.current_requests, ['fanout__matrix__unit_a', 'fanout__matrix__unit_b']);
  assert.equal(first.steps[0].ownerStepId, 'fanout');
  assert.equal(first.steps[0].matrix.unit_id, 'unit_a');
  assert.match(first.steps[0].compiledPrompt.prompt, /Matrix owner step: fanout/);

  const second = applyWorkflowOutput({
    workflowDoc,
    batonDoc: first.baton,
    outputValue: {
      steps: {
        fanout__matrix__unit_a: { outcome: 'ready', summary: 'A done' },
        fanout__matrix__unit_b: { outcome: 'ready', summary: 'B done' },
      },
    },
    resources,
  });
  assert.equal(second.baton.cursor, 'fanout');
  assert.deepEqual(second.steps.map((step) => step.id), ['fanout__matrix__unit_c']);
  assert.deepEqual(second.baton.state.matrix.fanout.current_requests, ['fanout__matrix__unit_c']);
  assert.equal(second.baton.state.matrix.fanout.units.filter((unit) => unit.status === 'accepted').length, 2);
  assert.equal(Object.hasOwn(second.baton.state, 'fanout__matrix__unit_a'), false);
  assert.equal(Object.hasOwn(second.baton.state.matrix.fanout.accepted_outputs.unit_a, 'output'), false);
  assert.deepEqual(second.baton.state.matrix.fanout.accepted_outputs.unit_a.output_ref, { step_id: 'fanout__matrix__unit_a' });

  const done = applyWorkflowOutput({
    workflowDoc,
    batonDoc: second.baton,
    outputValue: {
      steps: {
        fanout__matrix__unit_c: { outcome: 'ready', summary: 'C done' },
      },
    },
    resources,
  });
  assert.equal(done.baton.cursor, 'done');
  assert.equal(done.baton.status, 'done');
  assert.equal(done.baton.state.matrix.fanout.status, 'joined');
  assert.equal(done.baton.state.fanout.matrix_join_proof.coverage_complete, true);
  assert.deepEqual(done.baton.state.fanout.matrix_join_proof.accepted_unit_ids, ['unit_a', 'unit_b', 'unit_c']);
  assert.equal(Object.hasOwn(done.baton.state, 'fanout__matrix__unit_c'), false);
});

test('matrix dynamic source uses schema-covered input selector and safe context allowlist', () => {
  const workflowDoc = matrixWorkflow({
    fanout: {
      source: {
        from: '${{ input.producer.units }}',
        id_field: 'unit',
        context_fields: ['title'],
      },
    },
  });
  assert.deepEqual(validateWorkflow({ workflowDTO: workflowDoc, outputSchemas: resources.outputSchemas }).toJSON(), {
    ok: true,
    workflow: 'matrix-fixture',
    steps: 3,
  });

  const baton = {
    cursor: 'fanout',
    status: 'running',
    state: {
      artifacts: [],
      results: [],
      producer: {
        outcome: 'ready',
        units: [
          { unit: 'dyn_a', title: 'A', secret: 'must stay private' },
          { unit: 'dyn_b', title: 'B', secret: 'must stay private too' },
        ],
      },
    },
  };
  const first = runNext({ workflowDoc, batonDoc: baton, resources });
  assert.deepEqual(first.steps.map((step) => step.id), ['fanout__matrix__dyn_a', 'fanout__matrix__dyn_b']);
  assert.deepEqual(first.steps[0].matrix.context, { title: 'A' });
  assert.doesNotMatch(first.steps[0].compiledPrompt.prompt, /must stay private/);
  assert.equal(first.baton.state.matrix.fanout.source_fingerprint.includes('must stay private'), false);
});

test('matrix dynamic source rejects unsafe and duplicate runtime unit ids', () => {
  const workflowDoc = matrixWorkflow({
    fanout: {
      source: {
        from: '${{ input.producer.units }}',
        id_field: 'unit',
        context_fields: ['title'],
      },
    },
  });

  assert.throws(
    () => runNext({
      workflowDoc,
      batonDoc: {
        cursor: 'fanout',
        status: 'running',
        state: {
          artifacts: [],
          results: [],
          producer: {
            outcome: 'ready',
            units: [{ unit: '../bad', title: 'bad' }],
          },
        },
      },
      resources,
    }),
    /must be a safe matrix unit id/,
  );

  assert.throws(
    () => runNext({
      workflowDoc,
      batonDoc: {
        cursor: 'fanout',
        status: 'running',
        state: {
          artifacts: [],
          results: [],
          producer: {
            outcome: 'ready',
            units: [{ unit: 'same', title: 'A' }, { unit: 'same', title: 'B' }],
          },
        },
      },
      resources,
    }),
    /duplicate matrix unit id 'same'/,
  );
});

test('matrix retries invalid unit output and blocks after retry budget is exhausted', () => {
  const workflowDoc = matrixWorkflow({
    fanout: {
      source: { items: [{ id: 'unit_a', context: { title: 'A' } }] },
      max_attempts: 2,
    },
  });
  const first = runNext({ workflowDoc, batonDoc: emptyBaton, resources });
  const retry = applyWorkflowOutput({
    workflowDoc,
    batonDoc: first.baton,
    outputValue: { steps: { fanout__matrix__unit_a: { summary: 'missing outcome' } } },
    resources,
  });
  assert.equal(retry.baton.cursor, 'fanout');
  assert.deepEqual(retry.steps.map((step) => step.id), ['fanout__matrix__unit_a']);
  assert.equal(retry.baton.state.matrix.fanout.units[0].status, 'pending');
  assert.equal(retry.baton.state.matrix.fanout.units[0].attempts, 1);

  const blocked = applyWorkflowOutput({
    workflowDoc,
    batonDoc: retry.baton,
    outputValue: { steps: { fanout__matrix__unit_a: { summary: 'still missing outcome' } } },
    resources,
  });
  assert.equal(blocked.baton.cursor, 'fanout');
  assert.equal(blocked.baton.state.matrix.fanout.status, 'blocked');
  assert.equal(blocked.baton.state.matrix.fanout.join_proof.coverage_complete, false);
  assert.equal(blocked.baton.state.fanout.outcome, 'blocked');
  assert.deepEqual(blocked.baton.state.matrix.fanout.join_proof.blocked_unit_ids, ['unit_a']);
});

test('matrix accepted unit artifacts use synthetic request as producer without exposing full unit output', () => {
  const workflowDoc = matrixWorkflow({
    fanout: {
      source: { items: [{ id: 'unit_a', context: { title: 'A' } }] },
    },
  });
  const first = runNext({ workflowDoc, batonDoc: emptyBaton, resources });
  const done = applyWorkflowOutput({
    workflowDoc,
    batonDoc: first.baton,
    outputValue: {
      steps: {
        fanout__matrix__unit_a: {
          outcome: 'ready',
          artifacts: [{
            id: 'unit-artifact',
            content_type: 'text/markdown',
            path: '/runs/fanout__matrix__unit_a/artifacts/unit-artifact.md',
            summary: 'Unit artifact.',
          }],
        },
      },
    },
    resources,
  });
  assert.equal(done.baton.status, 'done');
  assert.equal(done.baton.state.artifacts[0].producerStepId, 'fanout__matrix__unit_a');
  assert.deepEqual(done.baton.state.matrix.fanout.accepted_outputs.unit_a.artifact_ids, ['unit-artifact']);
  assert.equal(Object.hasOwn(done.baton.state.matrix.fanout.accepted_outputs.unit_a, 'output'), false);
  assert.equal(Object.hasOwn(done.baton.state, 'fanout__matrix__unit_a'), false);
});
