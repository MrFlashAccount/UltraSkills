import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

test('ask_jeff uses the OpenAI transport without exposing the credential', async () => {
  let request;
  const result = await executeCallFunction({
    functionName: 'ask_jeff',
    argumentsValue: {
      model: 'example-model',
      api_key_file: 'secret.txt',
      prompt: 'Review this change',
    },
    outputSchema,
    workflowPath: '/workflow/workflow.json',
  }, {
    functions: callFunctionDefinitions,
    readFileImpl: async (filePath) => {
      assert.equal(filePath, '/workflow/secret.txt');
      return 'top-secret\n';
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ output: [{ content: [{ type: 'output_text', text: '{"answer":"ok"}' }] }] }),
      };
    },
  });
  assert.deepEqual(result, { answer: 'ok' });
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.authorization, 'Bearer top-secret');
  const body = JSON.parse(request.options.body);
  assert.equal(body.store, false);
  assert.equal(body.input, 'Review this change');
  assert.deepEqual(body.text.format.schema, outputSchema);
  assert.equal(body.text.format.strict, true);
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

test('ask_jeff requires HTTPS before attaching a credential', async () => {
  await assert.rejects(
    executeCallFunction({
      functionName: 'ask_jeff',
      argumentsValue: {
        base_url: 'http://gateway.example/v1',
        model: 'example-model',
        api_key_file: 'secret.txt',
        prompt: 'Review this change',
      },
      outputSchema,
      workflowPath: '/workflow/workflow.json',
    }, {
      functions: callFunctionDefinitions,
      readFileImpl: async () => 'top-secret',
      fetchImpl: async () => { throw new Error('fetch must not run'); },
    }),
    /must use HTTPS/,
  );
});

test('ask_jeff timeout covers credential reads and response bodies', async () => {
  const invocation = {
    functionName: 'ask_jeff',
    argumentsValue: {
      model: 'example-model',
      api_key_file: 'secret.txt',
      prompt: 'Review this change',
      timeout_ms: 20,
    },
    outputSchema,
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
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => new Promise(() => {}),
      }),
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
  const credentialPath = path.join(dir, 'private', 'missing-openai-key');
  writeFileSync(path.join(dir, 'output.schema.json'), `${JSON.stringify(outputSchema)}\n`);
  writeFileSync(workflowPath, `${JSON.stringify({
    name: 'call-credential-path',
    version: 1,
    start: 'invoke',
    done: 'done',
    steps: {
      invoke: {
        name: 'Ask Jeff',
        kind: 'call',
        function: 'ask_jeff',
        arguments: {
          model: 'example-model',
          api_key_file: credentialPath,
          prompt: 'Review this change',
        },
        output: { schema: 'output.schema.json' },
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
      assert.doesNotMatch(error.message, /missing-openai-key|call-credential-path/);
      return true;
    },
  );
  const history = readFileSync(path.join(runsRoot, runId, 'history.md'), 'utf8');
  assert.match(history, /API key file could not be read/);
  assert.doesNotMatch(history, /missing-openai-key|call-credential-path-/);
});
