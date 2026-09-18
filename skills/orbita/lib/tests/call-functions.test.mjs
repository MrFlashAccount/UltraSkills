import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from 'bun:test';
import { executeCallFunction } from '../call-functions/execute.mjs';
import { callFunctionDefinitions } from '../call-functions/registry.mjs';
import { resolveCallArguments, validateCallArguments } from '../call-functions/arguments.mjs';
import { validateWorkflow } from '../use-cases/ValidateWorkflow.mjs';
import { makeTestDir } from './helpers/test-temp-dir.mjs';
import { callFunction, continueRun, next, registerWorkflowRun, writeOutput } from './helpers/orbita-production-api.mjs';

const outputSchema = {
  type: 'object',
  required: ['answer'],
  properties: { answer: { type: 'string' } },
  additionalProperties: false,
};

test('call arguments preserve native values from whole path expressions', () => {
  const step = {
    arguments: {
      literal: 'prefix',
      selected: '${{ input.prepare.payload }}',
      nested: ['${{ input.prepare.count }}'],
    },
  };
  const resolved = resolveCallArguments(step, { prepare: { payload: { enabled: true }, count: 2 } });
  assert.deepEqual(resolved, { literal: 'prefix', selected: { enabled: true }, nested: [2] });
});

test('call functions validate parameters before execution', () => {
  assert.throws(
    () => validateCallArguments(callFunctionDefinitions.sh, { input: {} }),
    /must have required property 'script'/,
  );
});

test('sh and js call functions return structured JSON', async () => {
  const sh = await executeCallFunction({
    functionName: 'sh',
    argumentsValue: { script: "printf '%s' '{\"answer\":\"shell\"}'" },
    outputSchema,
    workflowPath: '/tmp/workflow.json',
  }, { functions: callFunctionDefinitions });
  assert.deepEqual(sh, { answer: 'shell' });

  const js = await executeCallFunction({
    functionName: 'js',
    argumentsValue: { source: 'return { answer: input.value };', input: { value: 'javascript' } },
    outputSchema,
    workflowPath: '/tmp/workflow.json',
  }, { functions: callFunctionDefinitions });
  assert.deepEqual(js, { answer: 'javascript' });
});

test('exec preserves argv boundaries and returns a non-zero exit as fixed output', async () => {
  const literalArgument = 'spaces ; $(not-a-shell)';
  const result = await executeCallFunction({
    functionName: 'exec',
    argumentsValue: {
      executable: process.execPath,
      args: [
        '-e',
        'process.stdout.write(process.argv[1]); process.stderr.write("diagnostic"); process.exit(7);',
        literalArgument,
      ],
    },
    workflowPath: '/tmp/workflow.json',
  }, { functions: callFunctionDefinitions });
  assert.deepEqual(result, {
    exit_code: 7,
    stdout: literalArgument,
    stderr: 'diagnostic',
  });
});

test('exec resolves cwd from the workflow directory', async () => {
  const dir = makeTestDir('call-exec-cwd');
  mkdirSync(path.join(dir, 'nested'));
  const result = await executeCallFunction({
    functionName: 'exec',
    argumentsValue: {
      executable: process.execPath,
      args: ['-e', 'process.stdout.write(process.cwd())'],
      cwd: 'nested',
    },
    workflowPath: path.join(dir, 'workflow.json'),
  }, { functions: callFunctionDefinitions });
  assert.equal(result.exit_code, 0);
  assert.equal(result.stdout, path.join(dir, 'nested'));
  assert.equal(result.stderr, '');
});

test('ask_jev evaluates typed questions with the fixed Jev gateway model', async () => {
  const questions = {
    review_required: {
      type: 'boolean',
      instructions: 'Does this change require manual review?',
    },
  };
  let request;
  const result = await executeCallFunction({
    functionName: 'ask_jev',
    argumentsValue: {
      api_key_file: 'secret.txt',
      state: { diff: 'example' },
      questions,
    },
    workflowPath: '/workflow/workflow.json',
  }, {
    functions: callFunctionDefinitions,
    readFileImpl: async (filePath) => {
      assert.equal(filePath, '/workflow/secret.txt');
      return 'top-secret\n';
    },
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({
        answers: {
          review_required: { type: 'boolean', probability: 0.82 },
        },
        usage: { inputTokens: 120, outputTokens: 1 },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(result, {
    review_required: { type: 'boolean', probability: 0.82 },
  });
  assert.equal(request.url, 'https://ai-gateway.vercel.sh/v4/ai/evaluation-model');
  const headers = new Headers(request.options.headers);
  assert.equal(headers.get('authorization'), 'Bearer top-secret');
  assert.equal(headers.get('ai-model-id'), 'typesafe-ai/jev');
  assert.equal(headers.get('ai-evaluation-model-specification-version'), '4');
  assert.deepEqual(JSON.parse(request.options.body), {
    state: { diff: 'example' },
    questions,
    providerOptions: {},
  });
  assert.doesNotMatch(request.options.body, /top-secret/);
  assert.equal(callFunctionDefinitions.openai, undefined);
});

test('workflow semantics distinguish call-defined and fixed function output schemas', () => {
  const workflow = {
    name: 'call-contract',
    version: 1,
    start: 'invoke',
    done: 'done',
    steps: {
      invoke: {
        name: 'Invoke',
        kind: 'call',
        function: 'sh',
        arguments: { script: "printf '%s' '{\"answer\":\"ok\"}'" },
        output: { schema: 'output.schema.json' },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  };
  assert.equal(validateWorkflow({ workflowDTO: workflow, outputSchemas: new Map([['output.schema.json', outputSchema]]) }).toJSON().ok, true);

  const fixedFunctions = {
    fixed: {
      name: 'fixed',
      parameters: { type: 'object', additionalProperties: false },
      output: { kind: 'fixed', schema: outputSchema },
      execute: async () => ({ answer: 'fixed' }),
    },
  };
  const fixedWorkflow = {
    ...workflow,
    steps: {
      ...workflow.steps,
      invoke: {
        name: 'Invoke',
        kind: 'call',
        function: 'fixed',
        arguments: {},
        next: 'done',
      },
    },
  };
  assert.equal(validateWorkflow({ workflowDTO: fixedWorkflow, outputSchemas: new Map(), externalSchemas: [], callFunctions: fixedFunctions }).toJSON().ok, true);
});

test('exec owns its fixed output schema', () => {
  const workflow = {
    name: 'exec-contract',
    version: 1,
    start: 'invoke',
    done: 'done',
    steps: {
      invoke: {
        name: 'Invoke executable',
        kind: 'call',
        function: 'exec',
        arguments: { executable: process.execPath },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  };
  assert.equal(validateWorkflow({ workflowDTO: workflow, externalSchemas: [] }).toJSON().ok, true);
  assert.throws(
    () => validateWorkflow({
      workflowDTO: {
        ...workflow,
        steps: {
          ...workflow.steps,
          invoke: { ...workflow.steps.invoke, output: { schema: 'output.schema.json' } },
        },
      },
      outputSchemas: new Map([['output.schema.json', outputSchema]]),
      externalSchemas: [],
    }),
    /owns its fixed output schema/,
  );
});

test('ask_jev owns its typed answer-map output schema', () => {
  const workflow = {
    name: 'jev-contract',
    version: 1,
    start: 'review',
    done: 'done',
    steps: {
      review: {
        name: 'Ask Jev',
        kind: 'call',
        function: 'ask_jev',
        arguments: {
          api_key_file: '.secrets/vercel-ai-gateway-key',
          state: { change: 'example' },
          questions: {
            review_required: {
              type: 'boolean',
              instructions: 'Does this change require manual review?',
            },
          },
        },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  };
  assert.equal(validateWorkflow({ workflowDTO: workflow, externalSchemas: [] }).toJSON().ok, true);
  assert.throws(
    () => validateWorkflow({
      workflowDTO: {
        ...workflow,
        steps: {
          ...workflow.steps,
          review: { ...workflow.steps.review, output: { schema: 'output.schema.json' } },
        },
      },
      outputSchemas: new Map([['output.schema.json', outputSchema]]),
      externalSchemas: [],
    }),
    /owns its fixed output schema/,
  );
});

test('fixed-output function definition owns its executable implementation', async () => {
  const fixedFunctions = {
    fixed: {
      name: 'fixed',
      parameters: { type: 'object', additionalProperties: false },
      output: { kind: 'fixed', schema: outputSchema },
      execute: async () => ({ answer: 'fixed' }),
    },
  };
  const result = await executeCallFunction({
    functionName: 'fixed',
    argumentsValue: {},
    outputSchema,
    workflowPath: '/tmp/workflow.json',
  }, { functions: fixedFunctions });
  assert.deepEqual(result, { answer: 'fixed' });
});

test('ask_jev rejects generic model and endpoint parameters', () => {
  assert.throws(
    () => validateCallArguments(callFunctionDefinitions.ask_jev, {
      api_key_file: 'secret.txt',
      state: 'Review this change',
      questions: {
        review_required: {
          type: 'boolean',
          instructions: 'Does this require review?',
        },
      },
      model: 'arbitrary-model',
      base_url: 'https://example.test/v1',
    }),
    /must NOT have additional properties/,
  );
});

test('ask_jev timeout covers credential reads and response bodies', async () => {
  const invocation = {
    functionName: 'ask_jev',
    argumentsValue: {
      api_key_file: 'secret.txt',
      state: 'Review this change',
      questions: {
        review_required: {
          type: 'boolean',
          instructions: 'Does this require review?',
        },
      },
      timeout_ms: 20,
    },
    workflowPath: '/workflow/workflow.json',
  };
  await assert.rejects(
    executeCallFunction(invocation, {
      functions: callFunctionDefinitions,
      readFileImpl: async () => new Promise(() => {}),
    }),
    /exceeded timeout of 20ms/,
  );
  await assert.rejects(
    executeCallFunction(invocation, {
      functions: callFunctionDefinitions,
      readFileImpl: async () => 'top-secret',
      createGatewayImpl: () => ({ evaluationModel: () => ({}) }),
      evaluateImpl: async () => new Promise(() => {}),
    }),
    /exceeded timeout of 20ms/,
  );
});

test('subprocess timeout terminates descendants', async () => {
  const dir = makeTestDir('call-descendants');
  const markerPath = path.join(dir, 'descendant-survived');
  const quotedMarkerPath = `'${markerPath.replaceAll("'", "'\\''")}'`;
  await assert.rejects(
    executeCallFunction({
      functionName: 'sh',
      argumentsValue: {
        script: `(sleep 0.2; printf survived > ${quotedMarkerPath}) & sleep 5`,
        timeout_ms: 30,
      },
      outputSchema,
      workflowPath: '/tmp/workflow.json',
    }, { functions: callFunctionDefinitions }),
    /exceeded timeout of 30ms/,
  );
  await Bun.sleep(300);
  assert.equal(existsSync(markerPath), false);
});

test('runner executes a call request and stores its validated result', async () => {
  const dir = makeTestDir('call-runner');
  const workflowPath = path.join(dir, 'workflow.json');
  writeFileSync(path.join(dir, 'output.schema.json'), `${JSON.stringify(outputSchema)}\n`);
  writeFileSync(workflowPath, `${JSON.stringify({
    name: 'call-runner',
    version: 1,
    start: 'invoke',
    done: 'done',
    steps: {
      invoke: {
        name: 'Invoke shell',
        kind: 'call',
        function: 'sh',
        arguments: { script: "printf '%s' '{\"answer\":\"executed\"}'" },
        output: { schema: 'output.schema.json' },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  })}\n`);
  const runId = `call-runner-${process.pid}-${Date.now()}`;
  const registered = await registerWorkflowRun({ runId, workflowPath, claim: true });
  const first = await next({ runId, workflowPath, leaseToken: registered.leaseToken });
  assert.equal(first.requests[0].action, 'call_function');
  assert.equal(first.requests[0].function, 'sh');
  assert.match(first.requests[0].executeCommand, /call-function/);
  assert.equal(Object.hasOwn(first.requests[0], 'arguments'), false);

  await callFunction({ runId, workflowPath, stepId: 'invoke', leaseToken: registered.leaseToken });
  const done = await continueRun({ runId, workflowPath, leaseToken: registered.leaseToken });
  assert.equal(done.status, 'done');
  assert.deepEqual(done.baton.state.invoke, { answer: 'executed' });
});

test('public write-output cannot forge a call-function result', async () => {
  const dir = makeTestDir('call-write-output-boundary');
  const runsRoot = makeTestDir('call-write-output-runs');
  const workflowPath = path.join(dir, 'workflow.json');
  writeFileSync(path.join(dir, 'output.schema.json'), `${JSON.stringify(outputSchema)}\n`);
  writeFileSync(workflowPath, `${JSON.stringify({
    name: 'call-write-output-boundary',
    version: 1,
    start: 'invoke',
    done: 'done',
    steps: {
      invoke: {
        name: 'Invoke shell',
        kind: 'call',
        function: 'sh',
        arguments: { script: "printf '%s' '{\"answer\":\"executed\"}'" },
        output: { schema: 'output.schema.json' },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  })}\n`);
  const runId = `call-write-output-${process.pid}-${Date.now()}`;
  const registered = await registerWorkflowRun({ runId, workflowPath, runsRoot, claim: true });
  await next({ runId, workflowPath, runsRoot, leaseToken: registered.leaseToken });
  await assert.rejects(
    writeOutput({
      runId,
      workflowPath,
      runsRoot,
      stepId: 'invoke',
      json: JSON.stringify({ answer: 'forged' }),
      leaseToken: registered.leaseToken,
    }),
    /must be executed through call-function/,
  );
  await callFunction({ runId, workflowPath, runsRoot, stepId: 'invoke', leaseToken: registered.leaseToken });
  const done = await continueRun({ runId, workflowPath, runsRoot, leaseToken: registered.leaseToken });
  assert.deepEqual(done.baton.state.invoke, { answer: 'executed' });
});

test('credential read failures do not expose paths in errors or durable history', async () => {
  const dir = makeTestDir('call-credential-path');
  const runsRoot = makeTestDir('call-credential-path-runs');
  const workflowPath = path.join(dir, 'workflow.json');
  const credentialPath = path.join(dir, 'private', 'missing-jev-key');
  writeFileSync(workflowPath, `${JSON.stringify({
    name: 'call-credential-path',
    version: 1,
    start: 'invoke',
    done: 'done',
    steps: {
      invoke: {
        name: 'Ask Jev',
        kind: 'call',
        function: 'ask_jev',
        arguments: {
          api_key_file: credentialPath,
          state: 'Review this change',
          questions: {
            review_required: {
              type: 'boolean',
              instructions: 'Does this require review?',
            },
          },
        },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  })}\n`);
  const runId = `call-credential-path-${process.pid}-${Date.now()}`;
  const registered = await registerWorkflowRun({ runId, workflowPath, runsRoot, claim: true });
  await next({ runId, workflowPath, runsRoot, leaseToken: registered.leaseToken });
  await assert.rejects(
    callFunction({ runId, workflowPath, runsRoot, stepId: 'invoke', leaseToken: registered.leaseToken }),
    (error) => {
      assert.match(error.message, /API key file could not be read/);
      assert.doesNotMatch(error.message, /missing-jev-key|call-credential-path/);
      return true;
    },
  );
  const history = readFileSync(path.join(runsRoot, runId, 'history.md'), 'utf8');
  assert.match(history, /API key file could not be read/);
  assert.doesNotMatch(history, /missing-jev-key|call-credential-path-/);
});
