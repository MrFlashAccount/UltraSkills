import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkflowRuntimeError } from '../errors.mjs';
import { validateWorkflow } from '../use-cases/ValidateWorkflow.mjs';

const routeSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome', 'route', 'next_steps'],
  properties: {
    outcome: { enum: ['ready', 'blocked'] },
    route: { enum: ['review', 'blocked'] },
    next_steps: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { enum: ['branch_a', 'branch_b'] },
    },
  },
  additionalProperties: false,
};

const outputSchemas = new Map([
  ['route-output.schema.json', routeSchema],
  ['open-route-output.schema.json', {
    ...routeSchema,
    properties: {
      ...routeSchema.properties,
      route: { type: 'string' },
    },
  }],
]);

function validate(doc) {
  return validateWorkflow({ workflowDTO: doc, outputSchemas }).toJSON();
}

function assertSemanticFailure(doc, pattern) {
  assert.throws(() => validate(doc), (error) => {
    assert.equal(error instanceof WorkflowRuntimeError, true);
    assert.match(error.message, pattern);
    return true;
  });
}

function outputContract(schema = 'route-output.schema.json') {
  return { template: 'worker.md', schema };
}

function syntheticWorkflow(overrides) {
  const doc = {
    name: 'loop-policy-validation-fixture',
    version: 1,
    start: 'producer',
    done: 'done',
    blocked: 'blocked',
    steps: {
      producer: {
        name: 'Producer',
        kind: 'worker',
        output: outputContract(),
        next: { match: '${{ output.outcome }}', cases: { ready: 'consumer', blocked: 'blocked' } },
      },
      consumer: {
        name: 'Consumer',
        kind: 'worker',
        input: {},
        output: outputContract(),
        next: 'done',
      },
      branch_a: {
        name: 'Branch A',
        kind: 'worker',
        input: {},
        output: outputContract(),
        next: 'join',
      },
      branch_b: {
        name: 'Branch B',
        kind: 'worker',
        input: {},
        output: outputContract(),
        next: 'join',
      },
      join: {
        name: 'Join',
        kind: 'worker',
        input: {},
        output: outputContract(),
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
      blocked: { name: 'Blocked', kind: 'done' },
    },
  };
  return overrides?.(doc) ?? doc;
}

test('workflow loopPolicies validate against exactly one SCC or self-loop region', () => {
  const valid = syntheticWorkflow((doc) => {
    doc.steps.producer.next = 'consumer';
    doc.steps.consumer.next = 'producer';
    doc.loopPolicies = {
      producer_consumer: { steps: ['producer', 'consumer'], maxIterations: 2, onLimit: 'blocked' },
    };
    return doc;
  });
  assert.deepEqual(validate(valid), { ok: true, workflow: 'loop-policy-validation-fixture', steps: Object.keys(valid.steps).length });

  const schemaLessApprovalRoute = syntheticWorkflow((doc) => {
    doc.steps.producer.next = 'consumer';
    doc.steps.consumer.next = 'producer';
    doc.steps.untyped_approval = {
      name: 'Untyped Approval',
      kind: 'approval',
      input: {},
      next: { match: '${{ output.approval }}', cases: { approved: 'done', rejected: 'blocked' } },
    };
    doc.loopPolicies = {
      producer_consumer: { steps: ['producer', 'consumer'], maxIterations: 2, onLimit: 'blocked' },
    };
    return doc;
  });
  assert.deepEqual(validate(schemaLessApprovalRoute), { ok: true, workflow: 'loop-policy-validation-fixture', steps: Object.keys(schemaLessApprovalRoute.steps).length });

  assertSemanticFailure(syntheticWorkflow((doc) => {
    doc.steps.producer.next = 'consumer';
    doc.steps.consumer.next = 'producer';
    doc.loopPolicies = {
      partial: { steps: ['producer'], maxIterations: 2, onLimit: 'blocked' },
    };
    return doc;
  }), /loopPolicy 'partial' steps must exactly match one unambiguous SCC or self-loop region/);

  assertSemanticFailure(syntheticWorkflow((doc) => {
    doc.steps.producer.next = 'consumer';
    doc.steps.consumer.next = 'producer';
    doc.loopPolicies = {
      bad_limit: { steps: ['producer', 'consumer'], maxIterations: 2, onLimit: 'producer' },
    };
    return doc;
  }), /onLimit target 'producer' stays inside the exhausted loop region/);

  assertSemanticFailure(syntheticWorkflow((doc) => {
    doc.steps.producer.next = 'consumer';
    doc.steps.consumer.next = 'producer';
    doc.steps.fallback = {
      name: 'Fallback',
      kind: 'worker',
      input: {},
      output: outputContract(),
      next: 'producer',
    };
    doc.loopPolicies = {
      bad_on_limit_path: { steps: ['producer', 'consumer'], maxIterations: 2, onLimit: 'fallback' },
    };
    return doc;
  }), /onLimit target 'fallback' routes back into the exhausted loop region/);

  assertSemanticFailure(syntheticWorkflow((doc) => {
    doc.steps.producer.next = 'consumer';
    doc.steps.consumer.next = 'producer';
    doc.loopPolicies = {
      first: { steps: ['producer', 'consumer'], maxIterations: 2, onLimit: 'blocked' },
      second: { steps: ['consumer'], maxIterations: 2, onLimit: 'blocked' },
    };
    return doc;
  }), /overlaps with loopPolicy 'first' at step 'consumer'/);

  assertSemanticFailure(syntheticWorkflow((doc) => {
    doc.steps.producer.next = 'consumer';
    doc.steps.consumer.next = 'producer';
    doc.loopPolicies = {
      ['__proto__']: { steps: ['producer', 'consumer'], maxIterations: 2, onLimit: 'blocked' },
    };
    return doc;
  }), /loopPolicy id '__proto__' is unsafe as a JavaScript object key/);
});

test('workflow loopPolicies reject fanout and non-enumerable dynamic routes', () => {
  assertSemanticFailure(syntheticWorkflow((doc) => {
    doc.steps.producer.next = ['branch_a', 'branch_b'];
    doc.steps.branch_a.next = 'producer';
    doc.steps.branch_b.next = 'producer';
    doc.loopPolicies = {
      fanout: { steps: ['producer', 'branch_a', 'branch_b'], maxIterations: 2, onLimit: 'blocked' },
    };
    return doc;
  }), /loopPolicy 'fanout' does not support fanout transition from step 'producer'/);

  assertSemanticFailure(syntheticWorkflow((doc) => {
    doc.steps.producer.output.schema = 'open-route-output.schema.json';
    doc.steps.producer.next = '${{ output.route }}';
    doc.steps.consumer.next = 'producer';
    doc.loopPolicies = {
      dynamic: { steps: ['producer', 'consumer'], maxIterations: 2, onLimit: 'blocked' },
    };
    return doc;
  }), /next expression .* open string schema must be constrained with enum or const values/);
});
