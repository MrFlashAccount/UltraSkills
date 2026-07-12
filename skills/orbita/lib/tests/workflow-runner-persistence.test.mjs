import assert from 'node:assert/strict';
import { claimWorkflowRunForTest, runWorkflowRunnerApi } from './helpers/workflow-runner-api-client.mjs';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { next as runnerNext } from './helpers/orbita-production-api.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-runner-check-'));
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn markdown.\n');
writeFileSync(path.join(tempDir, 'output.schema.json'), `${JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome'],
  properties: {
    outcome: { type: 'string' },
  },
  additionalProperties: true,
}, null, 2)}\n`);
writeFileSync(path.join(tempDir, 'approval-freeform.schema.json'), `${JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: true,
}, null, 2)}\n`);
const testLeaseToken = `workflow-runner-test-token-${process.pid}`;
const leaseTokensByRunId = new Map();
process.env.WORKFLOW_RUN_TOKEN = testLeaseToken;

const workflowDoc = {
    name: 'runner-check',
    version: 1,
    start: 'prepare',
    done: 'done',
    steps: {
      prepare: {
        name: 'Prepare',
        kind: 'worker',
        input: { prompt: 'Prepare branch.' },
        output: { template: 'output.md', schema: 'output.schema.json' },
        next: 'branch_a',
      },
      branch_a: {
        name: 'Branch A',
        kind: 'worker',
        input: { prompt: 'Run branch A.\nPrepare output:\n${{ input.prepare }}' },
        output: { template: 'output.md', schema: 'output.schema.json' },
        next: 'branch_b',
      },
      branch_b: {
        name: 'Branch B',
        kind: 'worker',
        input: { prompt: 'Run branch B.\nPrepare output:\n${{ input.prepare }}' },
        output: { template: 'output.md', schema: 'output.schema.json' },
        next: 'join',
      },
      join: {
        name: 'Join',
        kind: 'worker',
        input: { prompt: 'Join branch output.\nBranch A:\n${{ input.branch_a }}\nBranch B:\n${{ input.branch_b }}' },
        output: { template: 'output.md', schema: 'output.schema.json' },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
    },

};

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function claimRunForTest(paths) {
  return await claimWorkflowRunForTest(paths, { leaseTokensByRunId, testLeaseToken });
}

async function runCase(label, workflowPath) {
  const runId = `workflow-runner-test-${process.pid}-${label}`;
  const paths = resolveRunPaths({ runId, workflowPath });
  rmSync(paths.runDir, { recursive: true, force: true });
  if (workflowPath !== undefined) await claimRunForTest(paths);
  return { runId, runDir: paths.runDir };
}

function valueAfter(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function claimRunForRunnerArgs(args) {
  const runId = valueAfter(args, '--run-id');
  if (!runId) return undefined;
  const workflowPath = valueAfter(args, '--workflow');
  const knownToken = leaseTokensByRunId.get(runId);
  if (knownToken) return knownToken;
  const paths = resolveRunPaths({ runId, workflowPath });
  return await claimRunForTest(paths);
}

function withLeaseTokenArg(args, token) {
  if (args.includes('--lease-token') || !token) return args;
  const [mode, ...rest] = args;
  return [mode, `--lease-token=${token}`, ...rest];
}

function withDebugSummaryArg(args, options = {}) {
  if (args[0] !== 'write-output' || args.includes('--debug-summary-file') || options.debugSummary !== true) return args;
  const runId = valueAfter(args, '--run-id');
  const stepId = valueAfter(args, '--step-id');
  if (!runId || !stepId) return args;
  const runsRoot = valueAfter(args, '--runs-root');
  const debugSummaryPath = path.join(resolveRunPaths({ runId, runsRoot }).runDir, stepId, 'debug-summary.md');
  mkdirSync(path.dirname(debugSummaryPath), { recursive: true });
  writeFileSync(debugSummaryPath, options.debugSummaryText ?? `debug summary for ${stepId}\n`);
  return [...args, '--debug-summary-file', debugSummaryPath];
}

async function runRunner(args, options = {}) {
  const token = await claimRunForRunnerArgs(args);
  const runnerArgs = withDebugSummaryArg(withLeaseTokenArg(args, token), options);
  return runWorkflowRunnerApi(runnerArgs, { ...options, env: { WORKFLOW_RUN_TOKEN: token ?? testLeaseToken, ...(options.env ?? {}) } });
}

async function waitForPath(filePath) {
  const startedAt = Date.now();
  while (!existsSync(filePath)) {
    if (Date.now() - startedAt > 2000) throw new Error(`timed out waiting for ${filePath}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function expectRunner(args, label) {
  const result = await runRunner(args);
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function currentRequests(runId, workflowPath) {
  const response = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'derive current requests');
  return response.requests ?? [];
}

async function currentRequestIds(runId, workflowPath) {
  return (await currentRequests(runId, workflowPath)).map((request) => request.stepId ?? request.id);
}

function parseOutputRef(ref) {
  const separator = ref.indexOf('=');
  return separator < 0 ? { stepId: undefined, filePath: ref } : { stepId: ref.slice(0, separator), filePath: ref.slice(separator + 1) };
}

async function writeOutputFile({ runId, runDir, workflowPath, stepId, filePath, label = 'write output' }) {
  const requests = await currentRequests(runId, workflowPath);
  const targetStepId = stepId ?? requests.map((request) => request.stepId ?? request.id)[0];
  const request = requests.find((candidate) => (candidate.stepId ?? candidate.id) === targetStepId);
  const result = await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', targetStepId], {
    input: readFileSync(filePath, 'utf8'),
    debugSummary: request?.action === 'run_worker',
  });
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function continueWithOutputs({ runId, runDir, workflowPath, refs, label = 'continue' }) {
  const pendingIds = await currentRequestIds(runId, workflowPath);
  for (const ref of Array.isArray(refs) ? refs : [refs]) {
    const { stepId, filePath } = parseOutputRef(ref);
    const targetStepId = stepId ?? (pendingIds.length === 1 ? pendingIds[0] : undefined);
    assert.ok(targetStepId, `output for ${label} must name a step when multiple requests are pending`);
    await writeOutputFile({ runId, runDir, workflowPath, stepId: targetStepId, filePath, label: `${label} write ${targetStepId}` });
  }
  return await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], label);
}

function workerOutput(summary) {
  return { outcome: 'ready', results: [{ type: 'check', summary }] };
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

test('runner: persisted user prompt injection marker survives workflow drift on resume', async () => {
  const { runId, runDir } = await runCase('user-prompt-workflow-drift');
  const workflowPath = path.join(tempDir, 'user-prompt-workflow-drift.json');
  const driftWorkflow = structuredClone(workflowDoc);
  driftWorkflow.steps.prepare.next = 'branch_a';
  driftWorkflow.steps.branch_a.next = 'done';
  writeJson(workflowPath, driftWorkflow);
  const rawPrompt = 'Do not inject twice after workflow drift.';

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', rawPrompt], 'next before workflow drift');
  const prepareOutput = path.join(runDir, 'prepare-drift-output.json');
  writeJson(prepareOutput, workerOutput('prepared before drift'));
  await continueWithOutputs({ runId, runDir, workflowPath, refs: prepareOutput, label: 'continue before workflow drift' });

  delete driftWorkflow.steps.prepare;
  driftWorkflow.start = 'branch_a';
  driftWorkflow.steps.branch_a.input.prompt = 'Run branch A.';
  driftWorkflow.steps.branch_b.input.prompt = 'Run branch B.';
  writeJson(workflowPath, driftWorkflow);
  const resumed = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'rerender after workflow drift');
  assert.equal(resumed.baton.user_prompt_injected, true);

  const laterInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'branch_a']);
  assert.equal(laterInstructions.status, 0, laterInstructions.stderr);
  assert.doesNotMatch(laterInstructions.stdout, /## User prompt/);
  assert.equal(laterInstructions.stdout.includes(rawPrompt), false);
});

test('runner: continue applies single output and returns terminal done', async () => {
  const { runId, runDir } = await runCase('single-continue');
  const workflowPath = path.join(tempDir, 'single-continue-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next single continue');
  const outputPath = path.join(runDir, 'prepare-result.json');
  writeJson(outputPath, workerOutput('prepared'));
  const response = await continueWithOutputs({ runId, runDir, workflowPath, refs: outputPath, label: 'continue single' });

  assert.equal(response.status, 'done');
  assert.equal(response.baton.cursor, 'done');
  assert.equal(response.baton.status, 'done');
  assert.equal(response.baton.state.prepare.results[0].summary, 'prepared');
});

test('runner: continue reuses saved custom workflow when --workflow is omitted', async () => {
  const { runId, runDir } = await runCase('custom-workflow-continue');
  const workflowPath = path.join(tempDir, 'custom-workflow-continue.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.name = 'custom-workflow-continue';
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next custom workflow continue');
  const outputPath = path.join(runDir, 'prepare-result.json');
  writeJson(outputPath, workerOutput('prepared with saved workflow'));
  const response = await continueWithOutputs({ runId, runDir, workflowPath, refs: outputPath, label: 'continue custom workflow without workflow arg' });

  assert.equal(response.status, 'done');
  assert.equal('workflow' in response, false);
  assert.equal(response.baton.cursor, 'done');
  assert.equal(response.baton.state.prepare.results[0].summary, 'prepared with saved workflow');
});

test('runner: wait_for_approval request accepts request-specific host output JSON', async () => {
  const { runId, runDir } = await runCase('approval-generic-output');
  const workflowPath = path.join(tempDir, 'approval-generic-output-workflow.json');
  const approvalWorkflow = structuredClone(workflowDoc);
  approvalWorkflow.start = 'choose_path';
  approvalWorkflow.steps = {
    choose_path: {
      name: 'Choose path',
      kind: 'approval',
      input: { prompt: 'Ask the user to choose option_a, option_b, or a free-form reason.' },
      next: { match: '${{ output.choice }}', cases: { option_a: 'done', option_b: 'join' } },
    },
    join: approvalWorkflow.steps.join,
    done: approvalWorkflow.steps.done,
  };
  approvalWorkflow.steps.join.input.prompt = 'Join without branch prompt input.';
  approvalWorkflow.steps.join.next = 'done';
  writeJson(workflowPath, approvalWorkflow);

  const next = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next approval generic');
  assert.equal(next.status, 'needs_host_actions');
  assert.equal(next.requests[0].action, 'wait_for_approval');

  const outputPath = path.join(runDir, 'choose-path-answer.json');
  writeJson(outputPath, { choice: 'option_a', answer: 'Ship the smaller fix first.' });
  const response = await continueWithOutputs({ runId, runDir, workflowPath, refs: `choose_path=${outputPath}`, label: 'continue approval generic' });

  assert.equal(response.status, 'done');
  assert.equal(response.baton.cursor, 'done');
  assert.deepEqual(response.baton.state.choose_path, { choice: 'option_a', answer: 'Ship the smaller fix first.' });
});

test('runner: single approval request applies output by current stepId', async () => {
  const { runId, runDir } = await runCase('approval-step-id-output');
  const workflowPath = path.join(tempDir, 'approval-step-id-output-workflow.json');
  const approvalWorkflow = structuredClone(workflowDoc);
  approvalWorkflow.start = 'choose_path';
  approvalWorkflow.steps = {
    choose_path: {
      name: 'Choose path',
      kind: 'approval',
      input: { prompt: 'Ask the user to choose option_a or option_b.' },
      next: { match: '${{ output.choice }}', cases: { option_a: 'done', option_b: 'join' } },
    },
    join: approvalWorkflow.steps.join,
    done: approvalWorkflow.steps.done,
  };
  approvalWorkflow.steps.join.input.prompt = 'Join without branch prompt input.';
  approvalWorkflow.steps.join.next = 'done';
  writeJson(workflowPath, approvalWorkflow);

  const next = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next opaque approval');
  assert.equal(next.status, 'needs_host_actions');
  assert.equal(next.requests[0].stepId, 'choose_path');

  const outputPath = path.join(runDir, 'choose-path-answer.json');
  writeJson(outputPath, { choice: 'option_a', answer: 'Step id should not imply parallel.' });
  const response = await continueWithOutputs({ runId, runDir, workflowPath, refs: `choose_path=${outputPath}`, label: 'continue approval step id' });

  assert.equal(response.status, 'done');
  assert.equal(response.baton.cursor, 'done');
  assert.deepEqual(response.baton.state.choose_path, { choice: 'option_a', answer: 'Step id should not imply parallel.' });
});

test('runner: approval request exposes optional output schema reference', async () => {
  const { runId, runDir } = await runCase('approval-output-schema-request');
  const workflowPath = path.join(tempDir, 'approval-output-schema-request-workflow.json');
  const schemaPath = path.join(tempDir, 'approval-output-schema-request.schema.json');
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['choice'],
    properties: { choice: { enum: ['approved'] } },
    additionalProperties: false,
  });
  const approvalWorkflow = structuredClone(workflowDoc);
  approvalWorkflow.start = 'choose_path';
  approvalWorkflow.steps = {
    choose_path: {
      name: 'Choose path',
      kind: 'approval',
      input: { prompt: 'Ask the user whether to approve or block.' },
      output: { schema: path.basename(schemaPath) },
      next: { match: '${{ output.choice }}', cases: { approved: 'done' } },
    },
    done: approvalWorkflow.steps.done,
  };
  writeJson(workflowPath, approvalWorkflow);

  const response = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next approval output schema request');

  assert.equal(response.status, 'needs_host_actions');
  assert.equal(response.requests[0].action, 'wait_for_approval');
  assert.equal(response.requests[0].outputSchema, path.basename(schemaPath));
  assert.equal(response.requests[0].resolvedOutputSchema.ref, path.basename(schemaPath));
  assert.equal(Object.hasOwn(response.requests[0].resolvedOutputSchema, 'path'), false);
  assert.deepEqual(response.requests[0].resolvedOutputSchema.schema.required, ['choice']);
});

test('runner: typed approval retry preserves validation feedback in instructions', async () => {
  const { runId, runDir } = await runCase('approval-output-schema-retry');
  const workflowPath = path.join(tempDir, 'approval-output-schema-retry-workflow.json');
  const schemaPath = path.join(tempDir, 'approval-output-schema-retry.schema.json');
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['choice'],
    properties: { choice: { enum: ['approved'] } },
    additionalProperties: false,
  });
  const approvalWorkflow = structuredClone(workflowDoc);
  approvalWorkflow.start = 'choose_path';
  approvalWorkflow.steps = {
    choose_path: {
      name: 'Choose path',
      kind: 'approval',
      input: { prompt: 'Ask the user whether to approve or block.' },
      output: { schema: path.basename(schemaPath) },
      next: { match: '${{ output.choice }}', cases: { approved: 'done' } },
    },
    done: approvalWorkflow.steps.done,
  };
  writeJson(workflowPath, approvalWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next approval output schema retry');
  const outputPath = path.join(runDir, 'invalid-approval.json');
  writeJson(outputPath, { choice: 'maybe' });

  const rejected = await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'choose_path'], { input: readFileSync(outputPath, 'utf8') });

  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /output schema validation failed for step 'choose_path'/);
  const response = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'derive approval output schema retry request');
  assert.equal(response.status, 'needs_host_actions');
  assert.equal(response.requests[0].action, 'wait_for_approval');
  assert.equal(response.requests[0].outputSchema, path.basename(schemaPath));
  assert.equal(response.requests[0].resolvedOutputSchema.ref, path.basename(schemaPath));
  assert.equal(Object.hasOwn(response.requests[0].resolvedOutputSchema, 'path'), false);
  assert.deepEqual(response.requests[0].resolvedOutputSchema.schema.required, ['choice']);

  const loaded = await runRunner(['instructions', '--run-id', runId, '--step-id', 'choose_path']);
  assert.equal(loaded.status, 0, loaded.stderr);
  assert.doesNotMatch(loaded.stdout, /Previous output failed output\.schema validation/);
});
