import assert from 'node:assert/strict';
import { claimWorkflowRunForTest, runWorkflowRunnerApi } from './helpers/workflow-runner-api-client.mjs';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { next as runnerNext } from './helpers/orbita-production-api.mjs';
import { WORKFLOW_RUNNER_COMMAND as workflowRunnerCommand } from '../runner/runner-command-builder.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-runner-check-'));
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn markdown.\n');
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
        output: { template: 'output.md' },
        next: ['branch_a', 'branch_b'],
      },
      branch_a: {
        name: 'Branch A',
        kind: 'worker',
        input: { prompt: 'Run branch A.' },
        output: { template: 'output.md' },
        next: 'join',
      },
      branch_b: {
        name: 'Branch B',
        kind: 'worker',
        input: { prompt: 'Run branch B.' },
        output: { template: 'output.md' },
        next: 'join',
      },
      join: {
        name: 'Join',
        kind: 'worker',
        input: { prompt: 'Join branch output.' },
        output: { template: 'output.md' },
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

function workerOutput(summary) {
  return { outcome: 'ready', results: [{ type: 'check', summary }] };
}

function persistedCurrentRequestStepIds(runDir) {
  const currentRequests = JSON.parse(readFileSync(path.join(runDir, '.workflow-runner', 'current-requests.json'), 'utf8'));
  return (currentRequests.requests ?? currentRequests).map((request) => request.stepId ?? request.id).sort();
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
  if (separator < 0) return { stepId: undefined, filePath: ref };
  return { stepId: ref.slice(0, separator), filePath: ref.slice(separator + 1) };
}

async function writeOutputFile({ runId, runDir, workflowPath, stepId, filePath, label = 'write output', currentRequest }) {
  const requests = currentRequest ? [currentRequest] : await currentRequests(runId, workflowPath);
  const pendingIds = requests.map((request) => request.stepId ?? request.id);
  const targetStepId = stepId ?? pendingIds[0];
  const request = currentRequest ?? requests.find((item) => (item.stepId ?? item.id) === targetStepId);
  const result = await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', targetStepId], { input: readFileSync(filePath, 'utf8'), debugSummary: request?.action === 'run_worker' });
  assert.equal(result.status, 0, `${label} failed
stdout:
${result.stdout}
stderr:
${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function continueWithOutputs({ runId, runDir, workflowPath, refs, label = 'continue' }) {
  const normalized = Array.isArray(refs) ? refs : [refs];
  const requests = await currentRequests(runId, workflowPath);
  const pendingIds = requests.map((request) => request.stepId ?? request.id);
  for (const ref of normalized) {
    const { stepId, filePath } = parseOutputRef(ref);
    const targetStepId = stepId ?? (pendingIds.length === 1 ? pendingIds[0] : undefined);
    assert.ok(targetStepId, `output for ${label} must name a step when multiple requests are pending`);
    const currentRequest = requests.find((request) => (request.stepId ?? request.id) === targetStepId);
    await writeOutputFile({ runId, runDir, workflowPath, stepId: targetStepId, filePath, label: `${label} write ${targetStepId}`, currentRequest });
  }
  return await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], label);
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

test('runner: next returns a single host action request with load command only', async () => {
  const { runId, runDir } = await runCase('single');
  const workflowPath = path.join(tempDir, 'single-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  const response = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next single');
  const leaseToken = leaseTokensByRunId.get(runId);
  const runsRoot = resolveRunPaths({ runId }).runsRoot;

  assert.equal(response.status, 'needs_host_actions');
  assert.match(response.orchestratorInstruction, /^Supersedes all previous workflow-runner stdout\./);
  assert.match(response.orchestratorInstruction, /Execute every current host request below/);
  assert.match(response.orchestratorInstruction, /Use the JSON response requests field as the machine-readable source when available/);
  assert.match(response.orchestratorInstruction, /Current host requests:\n- run_worker: prepare/);
  assert.doesNotMatch(response.orchestratorInstruction, /run_worker request, enforce this host watchdog/);
  assert.match(response.orchestratorInstruction, new RegExp(`load fresh instructions: .*workflow-runner\\.mjs' instructions --run-id '${runId}' --step-id 'prepare' --runs-root '${runsRoot}' --lease-token '${leaseToken}'`));
  assert.match(response.orchestratorInstruction, new RegExp(`load follow-up instructions when restoring the preferred worker: .*workflow-runner\\.mjs' instructions --follow-up --run-id '${runId}' --step-id 'prepare' --runs-root '${runsRoot}' --lease-token '${leaseToken}'`));
  assert.match(response.orchestratorInstruction, /pass actual worker id to continue: --bind-agent 'prepare=<agent-id>'/);
  assert.doesNotMatch(response.orchestratorInstruction, /Before continue, record a concise orchestrator debug summary/);
  assert.doesNotMatch(response.orchestratorInstruction, /workflow-runner\.mjs' record-orchestrator/);
  assert.equal(response.orchestratorDebugCommand.includes(`record-orchestrator --run-id '${runId}' --runs-root '${runsRoot}' --lease-token '${leaseToken}'`), true);
  assert.equal(response.orchestratorInstruction.includes(`${workflowRunnerCommand} continue --run-id '${runId}' --runs-root '${runsRoot}' --lease-token '${leaseToken}' --bind-agent 'prepare=<agent-id>' --orchestrator-debug-json '<paste orchestrator debug JSON here>' --only-instructions`), true);
  assert.match(response.orchestratorInstruction, /Follow that stdout instruction exactly/);
  assert.doesNotMatch(response.orchestratorInstruction, /write-output/);
  assert.doesNotMatch(response.orchestratorInstruction, /Load instructions with:/);
  assert.doesNotMatch(response.orchestratorInstruction, /loaded instructions/);
  assert.doesNotMatch(response.orchestratorInstruction, /run workflow-runner continue exactly once/);
  assert.equal(response.baton.cursor, 'prepare');
  assert.deepEqual(response.requests.map((request) => request.id), ['prepare']);
  assert.equal(response.requests[0].action, 'run_worker');
  assert.equal(Object.hasOwn(response.requests[0], 'compiledPrompt'), false);
  assert.equal(response.requests[0].stepId, 'prepare');
  assert.equal(Object.hasOwn(response.requests[0], 'instructionRef'), false);
  assert.equal(response.requests[0].loadInstructionsCommand, `${workflowRunnerCommand} instructions --run-id '${runId}' --step-id 'prepare' --runs-root '${runsRoot}' --lease-token '${leaseToken}'`);
  assert.equal(response.requests[0].loadInstructionsCommand.startsWith("bun './"), false);
  assert.equal(response.requests[0].loadFollowupInstructionsCommand.startsWith("bun './"), false);
  assert.equal(response.requests[0].bindAgentCommand.startsWith("bun './"), false);
  assert.equal(response.orchestratorInstruction.includes("bun ./lib/entrypoints/cli/workflow-runner.mjs"), false);
  assert.equal(Object.hasOwn(response.requests[0], 'outputPath'), false);

  const loaded = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);
  assert.equal(loaded.status, 0, loaded.stderr);
  assert.match(loaded.stdout, /# Prepare/);

  assert.equal(existsSync(path.join(runDir, 'baton.json')), true);
});

test('runner: approval host instruction lists prompt input artifact content as required read', async () => {
  const { runId, runDir } = await runCase('approval-inline-instructions');
  const workflowPath = path.join(tempDir, 'approval-inline-instructions-workflow.json');
  const schemaPath = path.join(tempDir, 'approval-inline-instructions.schema.json');
  const prepareSchemaPath = path.join(tempDir, 'approval-inline-prepare-output.schema.json');
  writeJson(prepareSchemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { type: 'string' },
      artifacts: { type: 'array' },
      results: { type: 'array' },
    },
    additionalProperties: true,
  });
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['approval'],
    properties: {
      approval: { enum: ['approved', 'rejected', 'blocked'] },
      blocker: { type: 'object' },
    },
    additionalProperties: false,
  });
  const approvalWorkflow = structuredClone(workflowDoc);
  approvalWorkflow.steps.prepare.next = 'approve';
  approvalWorkflow.steps.prepare.output.schema = path.basename(prepareSchemaPath);
  approvalWorkflow.steps.approve = {
    name: 'Approve research',
    kind: 'approval',
    input: {
      prompt: 'Present artifact `reasons-canvas-research` from prepare to the user before asking for approval.\n\nArtifacts:\n${{ input.prepare.artifacts }}',
    },
    output: { schema: path.basename(schemaPath) },
    next: { match: '${{ output.approval }}', cases: { approved: 'done', rejected: 'prepare' } },
  };
  writeJson(workflowPath, approvalWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next before approval inline');
  const artifactPath = path.join(runDir, 'prepare', 'artifacts', 'reasons-canvas-research.md');
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, '# REASONS Canvas\n\nFull Canvas body for approval.\n');
  const prepareOutputPath = path.join(tempDir, 'approval-inline-instructions-output.json');
  writeJson(prepareOutputPath, {
    outcome: 'ready',
    artifacts: [
      {
        id: 'reasons-canvas-research',
        content_type: 'text/markdown',
        path: artifactPath,
        summary: 'summary only is insufficient',
      },
    ],
    results: [{ type: 'check', summary: 'research ready' }],
  });

  const response = await continueWithOutputs({ runId, runDir, workflowPath, refs: prepareOutputPath, label: 'continue to approval inline' });
  const leaseToken = leaseTokensByRunId.get(runId);

  assert.equal(response.status, 'needs_host_actions');
  assert.equal(response.requests[0].action, 'wait_for_approval');
  assert.deepEqual(Object.keys(response.requests[0]).sort(), ['action', 'id', 'loadInstructionsCommand', 'outputSchema', 'resolvedOutputSchema', 'stepId'].sort());
  assert.match(response.orchestratorInstruction, /Approval request: approve/);
  assert.match(response.orchestratorInstruction, /The orchestrator must execute this approval instruction itself\./);
  assert.match(response.orchestratorInstruction, /Use the following compiled approval prompt as the complete source/);
  assert.match(response.orchestratorInstruction, /When the compiled approval prompt lists required-read files or prompt input artifact paths, attach those files through the host\/platform approval mechanism before asking for a decision\./);
  assert.match(response.orchestratorInstruction, /In Codex\/Codex Desktop, attaching means rendering each listed local artifact as a Markdown file link with an absolute target/);
  assert.match(response.orchestratorInstruction, /\[reasons-canvas-research\.md\]\(\/absolute\/path\/reasons-canvas-research\.md\)/);
  assert.match(response.orchestratorInstruction, /A plain text path, artifact id, or summary is not an attachment\./);
  assert.match(response.orchestratorInstruction, /Do not replace artifact attachments with summaries, plain paths, or inline full artifact bodies\./);
  assert.match(response.orchestratorInstruction, /If the host cannot attach or render a file link for a listed artifact, state that capability gap explicitly in the approval message and include the path\/reference that could not be attached\./);
  assert.match(response.orchestratorInstruction, /Do not inspect workflow source, runner internals, schema files, or CLI help to reconstruct approval output\./);
  assert.match(response.orchestratorInstruction, /After the user decides, normalize the answer to strict JSON and submit it with this validating command:/);
  assert.match(response.orchestratorInstruction, new RegExp(`workflow-runner\\.mjs' write-output --run-id '${runId}' --step-id 'approve' --runs-root '${resolveRunPaths({ runId }).runsRoot}' --lease-token '${leaseToken}' <<'JSON'`));
  assert.match(response.orchestratorInstruction, /<paste strict JSON here>/);
  assert.match(response.orchestratorInstruction, /# Approve research/);
  assert.match(response.orchestratorInstruction, /## Required reads/);
  assert.match(response.orchestratorInstruction, /Prompt input artifact 'reasons-canvas-research' from 'prepare' \(text\/markdown\):/);
  assert.match(response.orchestratorInstruction, /prepare\/artifacts\/reasons-canvas-research\.md/);
  assert.match(response.orchestratorInstruction, /## Output contract/);
  assert.doesNotMatch(response.orchestratorInstruction, /## Prompt input context/);
  assert.doesNotMatch(response.orchestratorInstruction, /### Prompt input artifact content/);
  assert.doesNotMatch(response.orchestratorInstruction, /Full Canvas body for approval\./);
  assert.match(response.orchestratorInstruction, /## Workflow step prompt/);
  assert.match(response.orchestratorInstruction, /Present artifact `reasons-canvas-research`/);
  assert.match(response.orchestratorInstruction, new RegExp(`--lease-token '${leaseToken}'`));

});

test('runner: continue rejects legacy --output path handoff', async () => {
  const result = await runRunner(['continue', '--run-id', `workflow-runner-test-${process.pid}-legacy-output`, '--output', 'worker-output.json']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option '--output'|continue no longer accepts --output/);
});

test('runner: resumed next recomputes instructions without persisted prompt files', async () => {
  const { runId, runDir } = await runCase('next-validates-persisted-state');
  const workflowPath = path.join(tempDir, 'next-validates-persisted-state-workflow.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'done';
  writeJson(workflowPath, singleWorkflow);
  await claimRunForTest(resolveRunPaths({ runId, workflowPath }));

  const leaseToken = leaseTokensByRunId.get(runId);
  const first = await runnerNext({ runId, workflowPath, leaseToken });
  assert.equal(first.status, 'needs_host_actions');

  const instructionPath = path.join(runDir, '.workflow-runner', 'instructions', 'prepare.md');
  assert.equal(existsSync(instructionPath), false);
  const second = await runnerNext({ runId, workflowPath, leaseToken });
  assert.equal(second.status, 'needs_host_actions');
  assert.deepEqual(second.requests.map((request) => request.stepId), ['prepare']);
  assert.equal(existsSync(instructionPath), false);
});

test('runner: next rejects workflow whose first worker id is reserved baton state bookkeeping', async () => {
  const { runId, runDir } = await runCase('reserved-first-worker');
  const workflowPath = path.join(tempDir, 'reserved-first-worker-workflow.json');
  const reservedWorkflow = structuredClone(workflowDoc);
  reservedWorkflow.start = 'artifacts';
  reservedWorkflow.steps.artifacts = {
    ...reservedWorkflow.steps.prepare,
    name: 'Reserved first worker',
  };
  delete reservedWorkflow.steps.prepare;
  writeJson(workflowPath, reservedWorkflow);

  const result = await runRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', 'must not be skipped']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /workflow step id 'artifacts' is reserved for runtime aggregate state/);
});

test('runner: next rejects dynamic transition without output schema coverage before rendering', async () => {
  const { runId, runDir } = await runCase('dynamic-next-missing-schema');
  const workflowPath = path.join(tempDir, 'dynamic-next-missing-schema-workflow.json');
  const dynamicWorkflow = structuredClone(workflowDoc);
  dynamicWorkflow.steps.prepare.next = '${{ output.outcome }}';
  writeJson(workflowPath, dynamicWorkflow);

  const result = await runRunner(['next', '--run-id', runId, '--workflow', workflowPath]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /step 'prepare' next expression \$\{\{ output\.outcome \}\} has no schema-covered path/);
  assert.equal(existsSync(path.join(runDir, '.workflow-runner', 'instructions', 'prepare.md')), false);
});

test('runner: user prompt is stored, included only in initial worker instructions, and preserved on continue', async () => {
  const { runId, runDir } = await runCase('user-prompt-runtime');
  const workflowPath = path.join(tempDir, 'user-prompt-runtime-workflow.json');
  writeJson(workflowPath, workflowDoc);
  const rawPrompt = 'Raw startup task text.\nPreserve me exactly.';

  const first = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', rawPrompt], 'next with user prompt');
  assert.equal(first.baton.user_prompt, rawPrompt);
  assert.equal(first.baton.user_prompt_injected, undefined);
  assert.equal(JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8')).user_prompt, rawPrompt);
  assert.equal(JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8')).user_prompt_injected, undefined);

  const initialInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);
  assert.equal(initialInstructions.status, 0, initialInstructions.stderr);
  assert.match(initialInstructions.stdout, /## User prompt/);
  assert.equal(initialInstructions.stdout.includes(rawPrompt), true);

  const resumedBeforeOutput = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'resume before first output');
  assert.equal(resumedBeforeOutput.baton.user_prompt_injected, undefined);
  const resumedInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);
  assert.equal(resumedInstructions.status, 0, resumedInstructions.stderr);
  assert.match(resumedInstructions.stdout, /## User prompt/);
  assert.equal(resumedInstructions.stdout.includes(rawPrompt), true);

  const prepareOutput = path.join(runDir, 'prepare-output.json');
  writeJson(prepareOutput, workerOutput('prepared'));
  const nextResponse = await continueWithOutputs({ runId, runDir, workflowPath, refs: prepareOutput, label: 'continue with user prompt' });
  assert.equal(nextResponse.baton.user_prompt, rawPrompt);
  assert.equal(nextResponse.baton.user_prompt_injected, true);
  assert.equal(JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8')).user_prompt, rawPrompt);
  assert.equal(JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8')).user_prompt_injected, true);

  const laterInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'branch_a']);
  assert.equal(laterInstructions.status, 0, laterInstructions.stderr);
  assert.doesNotMatch(laterInstructions.stdout, /## User prompt/);
  assert.equal(laterInstructions.stdout.includes(rawPrompt), false);
});

test('runner: resumed next is read-only for baton after user prompt marker is persisted', async () => {
  const { runId, runDir } = await runCase('user-prompt-next-read-only-after-marker');
  const workflowPath = path.join(tempDir, 'user-prompt-next-read-only-after-marker.json');
  const singleWorkflow = structuredClone(workflowDoc);
  singleWorkflow.steps.prepare.next = 'branch_a';
  singleWorkflow.steps.branch_a.next = 'done';
  writeJson(workflowPath, singleWorkflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', 'marker must not be rolled back'], 'next before marker');
  const prepareOutput = path.join(runDir, 'prepare-output.json');
  writeJson(prepareOutput, workerOutput('prepared'));
  await continueWithOutputs({ runId, runDir, workflowPath, refs: prepareOutput, label: 'continue marker' });

  const batonPath = path.join(runDir, 'baton.json');
  const before = statSync(batonPath, { bigint: true }).mtimeNs;
  const resumed = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'resumed next after marker');
  const after = statSync(batonPath, { bigint: true }).mtimeNs;

  assert.equal(resumed.baton.user_prompt_injected, true);
  assert.equal(after, before);
});

test('runner: next rejects empty or conflicting user prompt inputs', async () => {
  const workflowPath = path.join(tempDir, 'user-prompt-negative-workflow.json');
  writeJson(workflowPath, workflowDoc);

  const { runId: emptyArgRunId } = await runCase('empty-user-prompt-next');
  const emptyArg = await runRunner(['next', '--run-id', emptyArgRunId, '--workflow', workflowPath, '--user-prompt', '']);
  assert.notEqual(emptyArg.status, 0);
  assert.match(emptyArg.stderr, /--user-prompt must not be empty or whitespace-only/);

  const promptPath = path.join(tempDir, 'empty-user-prompt-next-file.txt');
  writeFileSync(promptPath, '  \n');
  const { runId: emptyFileRunId } = await runCase('empty-user-prompt-file-next');
  const emptyFile = await runRunner(['next', '--run-id', emptyFileRunId, '--workflow', workflowPath, '--user-prompt-file', promptPath]);
  assert.notEqual(emptyFile.status, 0);
  assert.match(emptyFile.stderr, /--user-prompt-file must not be empty or whitespace-only/);

  const { runId: emptyPathRunId } = await runCase('empty-user-prompt-file-path-next');
  const emptyPath = await runRunner(['next', '--run-id', emptyPathRunId, '--workflow', workflowPath, '--user-prompt-file', '']);
  assert.notEqual(emptyPath.status, 0);
  assert.match(emptyPath.stderr, /--user-prompt-file path must not be empty or whitespace-only/);

  writeFileSync(promptPath, 'from file');
  const { runId: conflictingRunId } = await runCase('conflicting-user-prompt-next');
  const conflicting = await runRunner(['next', '--run-id', conflictingRunId, '--workflow', workflowPath, '--user-prompt', 'from arg', '--user-prompt-file', promptPath]);
  assert.notEqual(conflicting.status, 0);
  assert.match(conflicting.stderr, /provide only one of --user-prompt or --user-prompt-file/);
});

test('runner: API next rejects empty user prompt before persisting baton', async () => {
  const workflowPath = path.join(tempDir, 'api-empty-user-prompt-workflow.json');
  writeJson(workflowPath, workflowDoc);

  const { runId: emptyRunId, runDir: emptyRunDir } = await runCase('api-empty-user-prompt-next');
  const emptyLeaseToken = await claimRunForTest(resolveRunPaths({ runId: emptyRunId, workflowPath }));
  await assert.rejects(
    runnerNext({ runId: emptyRunId, workflowPath, userPrompt: '', leaseToken: emptyLeaseToken }),
    /--user-prompt must not be empty or whitespace-only/,
  );
  assert.equal(existsSync(path.join(emptyRunDir, 'baton.json')), false);

  const { runId: whitespaceRunId, runDir: whitespaceRunDir } = await runCase('api-whitespace-user-prompt-next');
  const whitespaceLeaseToken = await claimRunForTest(resolveRunPaths({ runId: whitespaceRunId, workflowPath }));
  await assert.rejects(
    runnerNext({ runId: whitespaceRunId, workflowPath, userPrompt: '  \n\t', leaseToken: whitespaceLeaseToken }),
    /--user-prompt must not be empty or whitespace-only/,
  );
  assert.equal(existsSync(path.join(whitespaceRunDir, 'baton.json')), false);
});

test('runner: CLI resume ignores deleted startup user prompt file and preserves persisted prompt', async () => {
  const { runId, runDir } = await runCase('user-prompt-resume-deleted-file');
  const workflowPath = path.join(tempDir, 'user-prompt-resume-deleted-file-workflow.json');
  const promptPath = path.join(tempDir, 'user-prompt-resume-deleted-file.txt');
  writeJson(workflowPath, workflowDoc);
  writeFileSync(promptPath, 'original file prompt');

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt-file', promptPath], 'next with prompt file');
  rmSync(promptPath, { force: true });
  const response = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt-file', promptPath], 'resume with deleted prompt file');

  assert.equal(response.resumed, true);
  assert.equal(response.baton.user_prompt, 'original file prompt');
  assert.equal(JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8')).user_prompt, 'original file prompt');
});

test('runner: user prompt is included in first worker when workflow starts with approval step', async () => {
  const { runId, runDir } = await runCase('user-prompt-control-start');
  const workflowPath = path.join(tempDir, 'user-prompt-control-start-workflow.json');
  const approvalFirstWorkflow = structuredClone(workflowDoc);
  approvalFirstWorkflow.start = 'gate';
  approvalFirstWorkflow.steps = {
    gate: {
      name: 'Gate',
      kind: 'approval',
      input: { prompt: 'Approve startup task.' },
      next: { match: '${{ output.approval }}', cases: { approved: 'prepare', retry: 'prepare' } },
    },
    ...approvalFirstWorkflow.steps,
  };
  writeJson(workflowPath, approvalFirstWorkflow);
  const rawPrompt = 'Raw task must reach first worker after approval.';

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', rawPrompt], 'next approval-first with user prompt');
  const gateInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'gate']);
  assert.equal(gateInstructions.status, 0, gateInstructions.stderr);
  assert.doesNotMatch(gateInstructions.stdout, /## User prompt/);
  assert.equal(gateInstructions.stdout.includes(rawPrompt), false);

  const approvalOutput = path.join(runDir, 'gate-output.json');
  writeJson(approvalOutput, { approval: 'approved' });
  await continueWithOutputs({ runId, runDir, workflowPath, refs: approvalOutput, label: 'continue approval-first gate' });
  const firstWorkerInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);
  assert.equal(firstWorkerInstructions.status, 0, firstWorkerInstructions.stderr);
  assert.match(firstWorkerInstructions.stdout, /## User prompt/);
  assert.equal(firstWorkerInstructions.stdout.includes(rawPrompt), true);

  const prepareOutput = path.join(runDir, 'prepare-output.json');
  writeJson(prepareOutput, workerOutput('prepared'));
  await continueWithOutputs({ runId, runDir, workflowPath, refs: prepareOutput, label: 'continue approval-first prepare' });
  const laterInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'branch_a']);
  assert.equal(laterInstructions.status, 0, laterInstructions.stderr);
  assert.doesNotMatch(laterInstructions.stdout, /## User prompt/);
  assert.equal(laterInstructions.stdout.includes(rawPrompt), false);
});

test('runner: startup prompt target rejects match-cases with worker and terminal branches', async () => {
  const { runId, runDir } = await runCase('user-prompt-match-terminal-rejected');
  const workflowPath = path.join(tempDir, 'user-prompt-match-terminal-rejected.json');
  const approvalFirstWorkflow = structuredClone(workflowDoc);
  approvalFirstWorkflow.start = 'gate';
  approvalFirstWorkflow.steps = {
    gate: {
      name: 'Gate',
      kind: 'approval',
      input: { prompt: 'Approve startup task.' },
      next: { match: '${{ output.approval }}', cases: { approved: 'prepare', rejected: 'done' } },
    },
    ...approvalFirstWorkflow.steps,
  };
  writeJson(workflowPath, approvalFirstWorkflow);

  const result = await runRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', 'Prompt must not be dropped.']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot determine stable startup user prompt target: workflow step 'gate' has a match\/cases branch with no worker target/);
});

test('runner: startup prompt target rejects a selected match-cases branch that no longer renders the target', async () => {
  const { runId, runDir } = await runCase('user-prompt-match-selected-target-missing');
  const workflowPath = path.join(tempDir, 'user-prompt-match-selected-target-missing.json');
  const approvalFirstWorkflow = structuredClone(workflowDoc);
  approvalFirstWorkflow.start = 'gate';
  approvalFirstWorkflow.steps = {
    gate: {
      name: 'Gate',
      kind: 'approval',
      input: { prompt: 'Choose startup route.' },
      next: { match: '${{ output.choice }}', cases: { approved: 'prepare', retry: 'prepare' } },
    },
    ...approvalFirstWorkflow.steps,
  };
  writeJson(workflowPath, approvalFirstWorkflow);

  const initial = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', 'Prompt must reach prepare.'], 'next stable match-cases');
  assert.equal(initial.baton.user_prompt_target, 'prepare');

  const approvalOutput = path.join(runDir, 'gate-output.json');
  writeJson(approvalOutput, { choice: 'approved' });
  await writeOutputFile({ runId, runDir, workflowPath, stepId: 'gate', filePath: approvalOutput, label: 'write selected target missing output' });
  approvalFirstWorkflow.steps.gate.next = { match: '${{ output.choice }}', cases: { approved: 'done', retry: 'prepare' } };
  writeJson(workflowPath, approvalFirstWorkflow);
  const result = await runRunner(['continue', '--run-id', runId, '--workflow', workflowPath]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /startup user prompt target 'prepare' is not renderable in the current workflow response/);
});

test('runner: startup prompt target rejects dynamic fanout before prompt selection can drift', async () => {
  const { runId, runDir } = await runCase('user-prompt-dynamic-fanout-rejected');
  const workflowPath = path.join(tempDir, 'user-prompt-dynamic-fanout-rejected.json');
  const approvalWorkflow = structuredClone(workflowDoc);
  approvalWorkflow.start = 'choose_path';
  approvalWorkflow.steps = {
    choose_path: {
      name: 'Choose path',
      kind: 'approval',
      input: { prompt: 'Ask whether to fan out.' },
      next: ['branch_a', '${{ output.extra_branch }}'],
    },
    branch_a: approvalWorkflow.steps.branch_a,
    branch_b: approvalWorkflow.steps.branch_b,
    join: approvalWorkflow.steps.join,
    done: approvalWorkflow.steps.done,
  };
  approvalWorkflow.steps.join.next = 'done';
  writeJson(workflowPath, approvalWorkflow);

  const result = await runRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', 'Prompt must not pick a drift-prone fanout target.']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot determine stable startup user prompt target: workflow step 'choose_path' uses dynamic or ambiguous next/);
});

test('runner: next resumes existing baton without overwriting user prompt', async () => {
  const { runId, runDir } = await runCase('user-prompt-resume');
  const workflowPath = path.join(tempDir, 'user-prompt-resume-workflow.json');
  writeJson(workflowPath, workflowDoc);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', 'original raw prompt'], 'next original user prompt');
  const response = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath, '--user-prompt', 'replacement raw prompt'], 'resume with replacement user prompt');

  assert.equal(response.resumed, true);
  assert.equal(response.baton.user_prompt, 'original raw prompt');
  assert.equal(JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8')).user_prompt, 'original raw prompt');

  const instructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);
  assert.equal(instructions.status, 0, instructions.stderr);
  assert.match(instructions.stdout, /## User prompt/);
  assert.equal(instructions.stdout.includes('original raw prompt'), true);
  assert.equal(instructions.stdout.includes('replacement raw prompt'), false);
});

function schemaCoveredWorkflow(overrides = {}) {
  const schemaPath = path.join(tempDir, `worker-output-${process.pid}-${Math.random().toString(16).slice(2)}.schema.json`);
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { enum: ['ready', 'needs_changes', 'passed'] },
      results: { type: 'array' },
      artifacts: { type: 'array' },
    },
    additionalProperties: true,
  });
  const workflow = structuredClone(workflowDoc);
  for (const step of Object.values(workflow.steps)) {
    if (step.kind === 'worker') step.output = { template: 'output.md', schema: path.basename(schemaPath) };
  }
  Object.assign(workflow.steps.prepare, overrides.prepare ?? {});
  Object.assign(workflow.steps.branch_a, overrides.branchA ?? {});
  Object.assign(workflow.steps.branch_b, overrides.branchB ?? {});
  Object.assign(workflow.steps.join, overrides.join ?? {});
  return workflow;
}

function matrixRunnerWorkflow() {
  const schemaPath = path.join(tempDir, `matrix-output-${process.pid}-${Math.random().toString(16).slice(2)}.schema.json`);
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { enum: ['ready', 'blocked'] },
      results: { type: 'array' },
      artifacts: { type: 'array' },
      summary: { type: 'string' },
    },
    additionalProperties: true,
  });
  return {
    name: 'matrix-runner-check',
    version: 1,
    start: 'fanout',
    done: 'done',
    steps: {
      fanout: {
        name: 'Fan out',
        kind: 'matrix',
        source: {
          items: [
            { id: 'unit_a', context: { title: 'A' } },
            { id: 'unit_b', context: { title: 'B' } },
            { id: 'unit_c', context: { title: 'C' } },
          ],
        },
        max_parallel: 2,
        worker: {
          input: { prompt: 'Handle one matrix unit.' },
          output: { template: 'output.md', schema: path.basename(schemaPath) },
        },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  };
}

test('runner: write-output accepts valid stdin JSON into baton state and continue advances without --output', async () => {
  const { runId, runDir } = await runCase('write-output-stdin-valid');
  const workflowPath = path.join(tempDir, 'write-output-stdin-valid-workflow.json');
  const workflow = schemaCoveredWorkflow({ prepare: { next: 'done' } });
  writeJson(workflowPath, workflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next before write-output');
  const written = await runRunner(['write-output', '--run-id', runId, '--step-id', 'prepare'], { input: JSON.stringify(workerOutput('prepared')), debugSummary: true });
  assert.equal(written.status, 0, written.stderr);
  const writtenResponse = JSON.parse(written.stdout);
  assert.equal(writtenResponse.ok, true);
  assert.equal(writtenResponse.runId, runId);
  assert.equal(writtenResponse.stepId, 'prepare');
  assert.equal(writtenResponse.accepted, true);
  assert.equal(Object.hasOwn(writtenResponse, 'orchestratorInstruction'), false);
  const batonAfterWrite = JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
  assert.equal(batonAfterWrite.cursor, 'prepare');
  assert.equal(batonAfterWrite.state.prepare.outcome, 'ready');

  const debugNote = { summary: 'worker prepared output', evidence: ['write-output accepted'] };
  const continued = await expectRunner(
    [
      'continue',
      '--run-id', runId,
      '--workflow', workflowPath,
      '--bind-agent', 'prepare=worker-continue-1',
      '--orchestrator-debug-json', JSON.stringify(debugNote),
    ],
    'continue from accepted output',
  );
  assert.equal(continued.status, 'done');
  assert.equal(continued.baton.state.prepare.outcome, 'ready');
  assert.deepEqual(continued.baton.workerBindings, { prepare: 'worker-continue-1' });
  const historyAfterContinue = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(historyAfterContinue, /source: workflow-runner-bind-agent/);
  assert.match(historyAfterContinue, /bound-agent:prepare/);
  assert.match(historyAfterContinue, /source: workflow-runner-orchestrator/);
  assert.match(historyAfterContinue, /worker prepared output/);
});

test('runner: write-output rejects valid worker output without required debug summary side-channel', async () => {
  const { runId, runDir } = await runCase('write-output-missing-debug-summary');
  const workflowPath = path.join(tempDir, 'write-output-missing-debug-summary-workflow.json');
  const workflow = schemaCoveredWorkflow({ prepare: { next: 'done' } });
  writeJson(workflowPath, workflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next before missing debug summary');
  const rejected = await runRunner(['write-output', '--run-id', runId, '--step-id', 'prepare'], { input: JSON.stringify(workerOutput('prepared')) });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /debug summary file is required for worker step 'prepare'/);
  const batonAfterReject = JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
  assert.equal(Object.hasOwn(batonAfterReject.state, 'prepare'), false);
});

test('runner: write-output rejects invalid JSON/schema without accepting output', async () => {
  const { runId, runDir } = await runCase('write-output-invalid');
  const workflowPath = path.join(tempDir, 'write-output-invalid-workflow.json');
  const workflow = schemaCoveredWorkflow({ prepare: { next: 'done' } });
  writeJson(workflowPath, workflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next before invalid write-output');
  const invalid = await runRunner(['write-output', '--run-id', runId, '--step-id', 'prepare'], { input: JSON.stringify({ results: [] }) });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /output schema validation failed for step 'prepare'/);
  const batonAfterInvalid = JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
  assert.equal(Object.hasOwn(batonAfterInvalid.state, 'prepare'), false);

  const continued = await runRunner(['continue', '--run-id', runId, '--workflow', workflowPath]);
  assert.notEqual(continued.status, 0);
  assert.match(continued.stderr, /missing accepted host output for workflow step prepare/);
});

test('runner: worker instructions include prefilled validating write-output command', async () => {
  const { runId } = await runCase('write-output-instructions');
  const workflowPath = path.join(tempDir, 'write-output-instructions-workflow.json');
  const workflow = schemaCoveredWorkflow({ prepare: { next: 'done' } });
  writeJson(workflowPath, workflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next before loading writer instructions');
  const instructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'prepare']);
  assert.equal(instructions.status, 0, instructions.stderr);
  assert.match(instructions.stdout, /workflow-runner\.mjs' write-output --run-id/);
  assert.match(instructions.stdout, /--step-id 'prepare'/);
  assert.match(instructions.stdout, /--lease-token '[^']+'/);
  assert.match(instructions.stdout, /--debug-summary-file '[^']+\/prepare\/debug-summary\.md'/);
  assert.doesNotMatch(instructions.stdout, /write-output[^\n]*--only-instructions/);
  assert.doesNotMatch(instructions.stdout, /--lease-token <lease-token>/);
  assert.match(instructions.stdout, /Do not create a separate JSON output file and do not pass an output path to the orchestrator/);
  assert.match(instructions.stdout, /Debug history summary:/);
  assert.match(instructions.stdout, /Do not put this debug summary in the JSON output/);
  assert.match(instructions.stdout, /before calling the validating writer command/);
  assert.match(instructions.stdout, /operational rationale/);
  assert.match(instructions.stdout, /Do not write history\.md directly/);
});

test('runner: matrix synthetic requests load instructions, accept unit outputs, and join through owner cursor', async () => {
  const { runId, runDir } = await runCase('matrix-synthetic-requests');
  const workflowPath = path.join(tempDir, 'matrix-synthetic-requests-workflow.json');
  writeJson(workflowPath, matrixRunnerWorkflow());

  const first = await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next matrix synthetic requests');
  assert.equal(first.status, 'needs_host_actions');
  assert.equal(first.baton.cursor, 'fanout');
  assert.deepEqual(first.requests.map((request) => request.stepId), ['fanout__matrix__unit_a', 'fanout__matrix__unit_b']);
  assert.deepEqual(first.requests.map((request) => request.ownerStepId), ['fanout', 'fanout']);
  assert.deepEqual(first.requests.map((request) => request.matrix.unit_id), ['unit_a', 'unit_b']);
  assert.equal(first.baton.state.matrix.fanout.current_requests.length, 2);

  const staleOwnerInstructions = await runRunner(['instructions', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'fanout']);
  assert.notEqual(staleOwnerInstructions.status, 0);
  assert.match(staleOwnerInstructions.stderr, /current request step ids: fanout__matrix__unit_a, fanout__matrix__unit_b/);

  const unitInstructions = await runRunner(['instructions', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'fanout__matrix__unit_a']);
  assert.equal(unitInstructions.status, 0, unitInstructions.stderr);
  assert.match(unitInstructions.stdout, /Matrix owner step: fanout/);
  assert.match(unitInstructions.stdout, /Matrix unit id: unit_a/);
  assert.match(unitInstructions.stdout, /--step-id 'fanout__matrix__unit_a'/);
  assert.match(unitInstructions.stdout, /--debug-summary-file '[^']+\/fanout__matrix__unit_a\/debug-summary\.md'/);

  const staleOwnerWrite = await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'fanout'], { input: JSON.stringify(workerOutput('owner')), debugSummary: true });
  assert.notEqual(staleOwnerWrite.status, 0);
  assert.match(staleOwnerWrite.stderr, /current request step ids: fanout__matrix__unit_a, fanout__matrix__unit_b/);

  assert.equal((await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'fanout__matrix__unit_a'], { input: JSON.stringify(workerOutput('A')), debugSummary: true })).status, 0);
  assert.equal((await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'fanout__matrix__unit_b'], { input: JSON.stringify(workerOutput('B')), debugSummary: true })).status, 0);
  const batonAfterWrites = JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
  assert.equal(batonAfterWrites.cursor, 'fanout');
  assert.equal(batonAfterWrites.state.fanout__matrix__unit_a.results[0].summary, 'A');
  assert.equal(batonAfterWrites.state.fanout__matrix__unit_b.results[0].summary, 'B');

  const second = await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], 'continue matrix to remaining unit');
  assert.equal(second.baton.cursor, 'fanout');
  assert.deepEqual(second.requests.map((request) => request.stepId), ['fanout__matrix__unit_c']);
  assert.equal(second.baton.state.matrix.fanout.units.filter((unit) => unit.status === 'accepted').length, 2);
  assert.equal(Object.hasOwn(second.baton.state, 'fanout__matrix__unit_a'), false);
  assert.equal(Object.hasOwn(second.baton.state.matrix.fanout.accepted_outputs.unit_a, 'output'), false);
  assert.deepEqual(second.baton.state.matrix.fanout.accepted_outputs.unit_a.output_ref, { step_id: 'fanout__matrix__unit_a' });

  const staleOldUnitWrite = await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'fanout__matrix__unit_a'], { input: JSON.stringify(workerOutput('old A')), debugSummary: true });
  assert.notEqual(staleOldUnitWrite.status, 0);
  assert.match(staleOldUnitWrite.stderr, /current request step ids: fanout__matrix__unit_c/);

  const unitCArtifactPath = path.join(runDir, 'fanout__matrix__unit_c', 'artifacts', 'unit-c.md');
  assert.equal((await runRunner(['write-output', '--run-id', runId, '--workflow', workflowPath, '--step-id', 'fanout__matrix__unit_c'], {
    input: JSON.stringify({
      ...workerOutput('C'),
      artifacts: [{
        id: 'unit-c',
        content_type: 'text/markdown',
        path: unitCArtifactPath,
        summary: 'Unit C artifact.',
      }],
    }),
    debugSummary: true,
  })).status, 0);
  const joined = await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], 'continue matrix join');
  assert.equal(joined.status, 'done');
  assert.equal(joined.baton.cursor, 'done');
  assert.equal(joined.baton.state.matrix.fanout.status, 'joined');
  assert.equal(joined.baton.state.fanout.matrix_join_proof.coverage_complete, true);
  assert.deepEqual(joined.baton.state.fanout.matrix_join_proof.accepted_unit_ids, ['unit_a', 'unit_b', 'unit_c']);
  assert.equal(joined.baton.state.artifacts.some((entry) => entry.producerStepId === 'fanout__matrix__unit_c' && entry.artifact.id === 'unit-c'), true);
  assert.deepEqual(joined.baton.state.matrix.fanout.accepted_outputs.unit_c.artifact_ids, ['unit-c']);
  assert.equal(Object.hasOwn(joined.baton.state, 'fanout__matrix__unit_c'), false);
});

test('runner: write-output separates parallel request outputs by step id before continue without --output', async () => {
  const { runId, runDir } = await runCase('write-output-parallel-step-ids');
  const workflowPath = path.join(tempDir, 'write-output-parallel-step-ids-workflow.json');
  const workflow = schemaCoveredWorkflow({ join: { next: 'done' } });
  writeJson(workflowPath, workflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next before prepare writer');
  assert.deepEqual(persistedCurrentRequestStepIds(runDir), ['prepare']);
  assert.equal((await runRunner(['write-output', '--run-id', runId, '--step-id', 'prepare'], { input: JSON.stringify(workerOutput('prepared')), debugSummary: true })).status, 0);
  assert.deepEqual(persistedCurrentRequestStepIds(runDir), ['prepare']);
  const fanout = await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], 'continue to parallel branches');
  assert.deepEqual(fanout.requests.map((request) => request.stepId).sort(), ['branch_a', 'branch_b']);
  assert.deepEqual(persistedCurrentRequestStepIds(runDir), ['branch_a', 'branch_b']);

  assert.equal((await runRunner(['write-output', '--run-id', runId, '--step-id', 'branch_a'], { input: JSON.stringify(workerOutput('A')), debugSummary: true })).status, 0);
  assert.equal((await runRunner(['write-output', '--run-id', runId, '--step-id', 'branch_b'], { input: JSON.stringify(workerOutput('B')), debugSummary: true })).status, 0);
  assert.deepEqual(persistedCurrentRequestStepIds(runDir), ['branch_a', 'branch_b']);
  const batonAfterWrites = JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
  assert.equal(batonAfterWrites.state.branch_a.results[0].summary, 'A');
  assert.equal(batonAfterWrites.state.branch_b.results[0].summary, 'B');

  const joined = await expectRunner(['continue', '--run-id', runId, '--workflow', workflowPath], 'continue from accepted parallel outputs');
  assert.equal(joined.status, 'needs_host_actions');
  assert.equal(joined.baton.cursor, 'join');
  assert.deepEqual(persistedCurrentRequestStepIds(runDir), ['join']);
  assert.equal(joined.baton.state.branch_a.results[0].summary, 'A');
  assert.equal(joined.baton.state.branch_b.results[0].summary, 'B');
});

test('runner: repeated parallel fanout uses cursor branches and latest overwritten branch state', async () => {
  const { runId, runDir } = await runCase('repeated-parallel-fanout-latest-state');
  const workflowPath = path.join(tempDir, 'repeated-parallel-fanout-latest-state-workflow.json');
  const schemaPath = path.join(tempDir, 'repeated-parallel-fanout-output.schema.json');
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { enum: ['ready', 'needs_changes', 'passed'] },
      results: { type: 'array' },
      artifacts: { type: 'array' },
    },
    additionalProperties: true,
  });
  const output = { template: 'output.md', schema: path.basename(schemaPath) };
  const workflow = {
    name: 'repeated-parallel-fanout-latest-state',
    version: 1,
    start: 'implementation_join',
    done: 'done',
    steps: {
      implementation_join: {
        name: 'Implementation join',
        kind: 'worker',
        input: { prompt: 'Join implementation.' },
        output,
        next: 'review_dispatch',
      },
      review_dispatch: {
        name: 'Review dispatch',
        kind: 'worker',
        input: { prompt: 'Dispatch reviews.' },
        output,
        next: ['backend_review', 'frontend_review'],
      },
      backend_review: {
        name: 'Backend review',
        kind: 'worker',
        input: { prompt: 'Review backend.' },
        output,
        next: 'review_join',
      },
      frontend_review: {
        name: 'Frontend review',
        kind: 'worker',
        input: { prompt: 'Review frontend.' },
        output,
        next: 'review_join',
      },
      review_join: {
        name: 'Review join',
        kind: 'worker',
        input: {
          prompt: [
            'Join review outputs.',
            'Backend: ${{ input.backend_review.results }}',
            'Frontend: ${{ input.frontend_review.results }}',
          ],
        },
        output,
        next: {
          match: '${{ output.outcome }}',
          cases: {
            ready: 'done',
            needs_changes: 'implementation_join',
            passed: 'done',
          },
        },
      },
      done: { name: 'Done', kind: 'done', input: { prompt: 'Done.' } },
    },
  };
  writeJson(workflowPath, workflow);

  await expectRunner(['next', '--run-id', runId, '--workflow', workflowPath], 'next repeated fanout');
  const implV1 = path.join(runDir, 'implementation-v1.json');
  const dispatchV1 = path.join(runDir, 'dispatch-v1.json');
  const backendV1 = path.join(runDir, 'backend-v1.json');
  const frontendV1 = path.join(runDir, 'frontend-v1.json');
  const joinRetry = path.join(runDir, 'join-retry.json');
  writeJson(implV1, workerOutput('implementation v1'));
  writeJson(dispatchV1, workerOutput('dispatch v1'));
  writeJson(backendV1, workerOutput('backend v1'));
  writeJson(frontendV1, workerOutput('frontend v1'));
  writeJson(joinRetry, { outcome: 'needs_changes', results: [{ type: 'check', summary: 'review needs changes' }] });
  const firstDispatch = await continueWithOutputs({ runId, runDir, workflowPath, refs: implV1, label: 'continue implementation v1' });
  assert.equal(firstDispatch.baton.cursor, 'review_dispatch');
  const firstFanout = await continueWithOutputs({ runId, runDir, workflowPath, refs: dispatchV1, label: 'continue dispatch v1' });
  assert.deepEqual(firstFanout.baton.cursor, ['backend_review', 'frontend_review']);
  assert.deepEqual(firstFanout.requests.map((request) => request.id), ['backend_review', 'frontend_review']);
  const firstJoin = await continueWithOutputs({
    runId,
    runDir,
    workflowPath,
    refs: [`backend_review=${backendV1}`, `frontend_review=${frontendV1}`],
    label: 'continue review v1',
  });
  assert.equal(firstJoin.baton.cursor, 'review_join');
  const retry = await continueWithOutputs({ runId, runDir, workflowPath, refs: joinRetry, label: 'continue review join retry' });
  assert.equal(retry.baton.cursor, 'implementation_join');

  const implV2 = path.join(runDir, 'implementation-v2.json');
  const dispatchV2 = path.join(runDir, 'dispatch-v2.json');
  const backendV2 = path.join(runDir, 'backend-v2.json');
  const frontendV2 = path.join(runDir, 'frontend-v2.json');
  writeJson(implV2, workerOutput('implementation v2'));
  writeJson(dispatchV2, workerOutput('dispatch v2'));
  writeJson(backendV2, workerOutput('backend v2'));
  writeJson(frontendV2, workerOutput('frontend v2'));
  await continueWithOutputs({ runId, runDir, workflowPath, refs: implV2, label: 'continue implementation v2' });
  const secondFanout = await continueWithOutputs({ runId, runDir, workflowPath, refs: dispatchV2, label: 'continue dispatch v2' });
  assert.deepEqual(secondFanout.baton.cursor, ['backend_review', 'frontend_review']);
  assert.deepEqual(secondFanout.requests.map((request) => request.id), ['backend_review', 'frontend_review']);
  const secondJoin = await continueWithOutputs({
    runId,
    runDir,
    workflowPath,
    refs: [`backend_review=${backendV2}`, `frontend_review=${frontendV2}`],
    label: 'continue review v2',
  });

  assert.equal(secondJoin.baton.cursor, 'review_join');
  assert.equal(secondJoin.baton.state.backend_review.results[0].summary, 'backend v2');
  assert.equal(secondJoin.baton.state.frontend_review.results[0].summary, 'frontend v2');
  const joinInstructions = await runRunner(['instructions', '--run-id', runId, '--step-id', 'review_join']);
  assert.equal(joinInstructions.status, 0, joinInstructions.stderr);
  assert.match(joinInstructions.stdout, /backend v2/);
  assert.match(joinInstructions.stdout, /frontend v2/);
  assert.doesNotMatch(joinInstructions.stdout, /backend v1/);
  assert.doesNotMatch(joinInstructions.stdout, /frontend v1/);
}, 500);
