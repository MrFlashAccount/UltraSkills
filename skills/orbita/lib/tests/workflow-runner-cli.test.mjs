import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { claimWorkflowRunForTest } from './helpers/workflow-runner-api-client.mjs';
import { makeTestDir } from './helpers/test-temp-dir.mjs';
import { WORKFLOW_RUNNER_COMMAND as workflowRunnerCommand } from '../runner/runner-command-builder.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { HOST_JSON_INPUT_MAX_BYTES } from '../host-json-input.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const tempDir = makeTestDir('workflow-runner-cli-check');
const testLeaseToken = `workflow-runner-cli-test-token-${process.pid}`;
const leaseTokensByRunId = new Map();
process.env.WORKFLOW_RUN_TOKEN = testLeaseToken;

writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn markdown.\n');
writeFileSync(path.join(tempDir, 'output.schema.json'), `${JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome'],
  properties: { outcome: { type: 'string' } },
  additionalProperties: true,
}, null, 2)}\n`);

const workflowDoc = {
  name: 'runner-cli-check',
  version: 1,
  start: 'prepare',
  done: 'done',
  steps: {
    prepare: {
      name: 'Prepare',
      kind: 'worker',
      input: { prompt: 'Prepare branch.' },
      output: { template: 'output.md', schema: 'output.schema.json' },
      next: 'done',
    },
    done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
  },
};

const pointerWorkflowDoc = {
  ...workflowDoc,
  start: 'prepare',
  steps: {
    prepare: {
      name: 'Prepare',
      kind: 'worker',
      input: { prompt: 'Prepare.' },
      output: { template: 'output.md', schema: 'output.schema.json' },
      next: 'review',
    },
    review: {
      name: 'Review',
      kind: 'worker',
      input: { prompt: 'Review.' },
      output: { template: 'output.md', schema: 'output.schema.json' },
      next: 'finalize',
    },
    finalize: {
      name: 'Finalize',
      kind: 'worker',
      input: { prompt: 'Finalize.' },
      output: { template: 'output.md', schema: 'output.schema.json' },
      next: 'done',
    },
    done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
  },
};

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function runCase(label, workflowPath) {
  const runId = `workflow-runner-cli-test-${process.pid}-${label}`;
  const paths = resolveRunPaths({ runId, workflowPath });
  rmSync(paths.runDir, { recursive: true, force: true });
  if (workflowPath !== undefined) await claimWorkflowRunForTest(paths, { leaseTokensByRunId, testLeaseToken });
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
  return await claimWorkflowRunForTest(paths, { leaseTokensByRunId, testLeaseToken });
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

async function runRunnerCli(args, options = {}) {
  const token = await claimRunForRunnerArgs(args);
  const runnerArgs = withDebugSummaryArg(withLeaseTokenArg(args, token), options);
  return spawnSync(process.execPath, ['skills/orbita/lib/entrypoints/cli/workflow-runner.mjs', ...runnerArgs], {
    cwd: root,
    encoding: 'utf8',
    input: options.input,
    env: { ...process.env, WORKFLOW_RUN_TOKEN: token ?? testLeaseToken, ...(options.env ?? {}) },
  });
}

function workerOutput(summary) {
  return { outcome: 'ready', results: [{ type: 'check', summary }] };
}

function terminalResponseFromOrchestratorInstruction(instruction) {
  const match = instruction.match(/\nStop now\. Do not call another runner command\. Terminal response JSON: (.+)\nReport /);
  assert.ok(match, instruction);
  return JSON.parse(match[1]);
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

test('validate-workflow CLI rejects every step ID that runner storage cannot represent', () => {
  for (const stepId of ['bad/id', 'bad id', 'шаг', '.', '..']) {
    const invalid = structuredClone(workflowDoc);
    invalid.start = stepId;
    invalid.steps = { [stepId]: invalid.steps.prepare, done: invalid.steps.done };
    const workflowPath = path.join(tempDir, `invalid-step-id-${Buffer.from(stepId).toString('hex')}.json`);
    writeJson(workflowPath, invalid);
    const result = spawnSync(process.execPath, ['skills/orbita/lib/entrypoints/cli/validate-workflow.mjs', workflowPath], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /workflow failed schema validation/);
  }
});

test('runner CLI: generated load-instructions command works from another cwd', async () => {
  const workflowPath = path.join(tempDir, 'portable-load-command-workflow.json');
  writeJson(workflowPath, workflowDoc);
  const { runId } = await runCase('portable-load-command', workflowPath);

  const result = await runRunnerCli(['next', '--run-id', runId, '--workflow', workflowPath]);
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  const leaseToken = leaseTokensByRunId.get(runId);
  const runsRoot = resolveRunPaths({ runId }).runsRoot;
  assert.equal(response.requests[0].loadInstructionsCommand, `${workflowRunnerCommand} instructions --run-id '${runId}' --step-id 'prepare' --runs-root '${runsRoot}' --lease-token '${leaseToken}'`);

  const loadedFromOtherCwd = spawnSync(response.requests[0].loadInstructionsCommand, {
    cwd: tempDir,
    encoding: 'utf8',
    shell: true,
  });
  assert.equal(loadedFromOtherCwd.status, 0, loadedFromOtherCwd.stderr);
  assert.match(loadedFromOtherCwd.stdout, /# Prepare/);
});

test('runner CLI: next --only-instructions prints only orchestrator instruction text', async () => {
  const workflowPath = path.join(tempDir, 'only-instructions-workflow.json');
  writeJson(workflowPath, workflowDoc);
  const { runId } = await runCase('only-instructions', workflowPath);

  const result = await runRunnerCli(['next', '--run-id', runId, '--workflow', workflowPath, '--only-instructions']);
  assert.equal(result.status, 0, result.stderr);
  assert.throws(() => JSON.parse(result.stdout));
  assert.match(result.stdout, /Execute every current host request below/);
  assert.match(result.stdout, /Current host requests:\n- run_worker: prepare/);
  assert.match(result.stdout, /fresh-worker instruction-loader command: .*workflow-runner\.mjs' instructions --run-id/);
  assert.match(result.stdout, /send that command to the worker bootstrap; do not run it in the orchestrator/);
  assert.match(result.stdout, /preferred-worker follow-up instruction-loader command: .*instructions --follow-up --run-id/);
  assert.match(result.stdout, /send that command only when restoring the preferred worker; do not run it in the orchestrator/);
  assert.match(result.stdout, /pass actual worker id to continue: --bind-agent 'prepare=<agent-id>'/);
  assert.match(result.stdout, /workflow-runner\.mjs' continue --run-id/);
  assert.match(result.stdout, /--bind-agent 'prepare=<agent-id>'/);
  assert.match(result.stdout, /--orchestrator-debug-json '<paste orchestrator debug JSON here>'/);
  assert.match(result.stdout, /--only-instructions/);
});

test('runner CLI: rejects unindexed legacy run state instead of minting authority', async () => {
  const runId = `workflow-runner-cli-test-${process.pid}-legacy-unindexed`;
  const workflowPath = path.join(tempDir, 'legacy-unindexed-workflow.json');
  writeJson(workflowPath, workflowDoc);
  const paths = resolveRunPaths({ runId, workflowPath });
  rmSync(paths.runDir, { recursive: true, force: true });
  mkdirSync(paths.runDir, { recursive: true });
  writeJson(paths.batonPath, { cursor: 'prepare', status: 'running', state: { artifacts: [], results: [] } });

  const result = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'next',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--lease-token', 'legacy-token-must-not-create-authority',
  ], { cwd: root, encoding: 'utf8', env: process.env });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires indexed lease authority/);
  assert.doesNotMatch(result.stderr, /\.workflow-runs\/runs\.json/);
});

test('runner CLI: non-next modes reject empty user prompt file option', async () => {
  const { runId } = await runCase('unsupported-user-prompt-file');
  const result = await runRunnerCli(['instructions', '--run-id', runId, '--step-id', 'prepare', '--user-prompt-file', '']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: bun \.\/lib\/entrypoints\/cli\/workflow-runner\.mjs/);
});

test('runner CLI: write-output reads stdin JSON', async () => {
  const workflowPath = path.join(tempDir, 'write-output-stdin-valid-workflow.json');
  writeJson(workflowPath, workflowDoc);
  const { runId, runDir } = await runCase('write-output-stdin-valid', workflowPath);

  const next = await runRunnerCli(['next', '--run-id', runId, '--workflow', workflowPath]);
  assert.equal(next.status, 0, next.stderr);
  const written = await runRunnerCli(['write-output', '--run-id', runId, '--step-id', 'prepare'], {
    input: JSON.stringify(workerOutput('prepared')),
    debugSummary: true,
  });
  assert.equal(written.status, 0, written.stderr);
  const writtenResponse = JSON.parse(written.stdout);
  assert.equal(writtenResponse.ok, true);
  assert.equal(writtenResponse.stepId, 'prepare');
  const batonAfterWrite = JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
  assert.equal(batonAfterWrite.state.prepare.outcome, 'ready');
});

test('runner CLI: continue accepts bind-agent and orchestrator debug flags', async () => {
  const workflowPath = path.join(tempDir, 'continue-side-effects-workflow.json');
  writeJson(workflowPath, workflowDoc);
  const { runId, runDir } = await runCase('continue-side-effects', workflowPath);

  const next = await runRunnerCli(['next', '--run-id', runId, '--workflow', workflowPath]);
  assert.equal(next.status, 0, next.stderr);
  const written = await runRunnerCli(['write-output', '--run-id', runId, '--step-id', 'prepare'], {
    input: JSON.stringify(workerOutput('prepared')),
    debugSummary: true,
  });
  assert.equal(written.status, 0, written.stderr);

  const continued = await runRunnerCli([
    'continue',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--bind-agent', 'prepare=cli-worker-1',
    '--orchestrator-debug-json', JSON.stringify({ summary: 'cli combined continue', evidence: ['write-output accepted'] }),
  ]);
  assert.equal(continued.status, 0, continued.stderr);
  const response = JSON.parse(continued.stdout);
  assert.equal(response.status, 'done');
  assert.deepEqual(response.baton.workerBindings, { prepare: 'cli-worker-1' });
  const history = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.match(history, /source: workflow-runner-continue-bind-agent/);
  assert.match(history, /cli combined continue/);
});

test('runner CLI: continue --only-instructions prints terminal instruction text', async () => {
  const workflowPath = path.join(tempDir, 'continue-only-instructions-workflow.json');
  writeJson(workflowPath, workflowDoc);
  const { runId } = await runCase('continue-only-instructions', workflowPath);

  const next = await runRunnerCli(['next', '--run-id', runId, '--workflow', workflowPath]);
  assert.equal(next.status, 0, next.stderr);
  const written = await runRunnerCli(['write-output', '--run-id', runId, '--step-id', 'prepare'], {
    input: JSON.stringify(workerOutput('prepared')),
    debugSummary: true,
  });
  assert.equal(written.status, 0, written.stderr);
  const continued = await runRunnerCli(['continue', '--run-id', runId, '--workflow', workflowPath, '--only-instructions']);
  assert.equal(continued.status, 0, continued.stderr);
  assert.throws(() => JSON.parse(continued.stdout));
  assert.match(continued.stdout, /^Supersedes all previous workflow-runner stdout\./);
  assert.match(continued.stdout, /Stop now/);
  const terminalResponse = terminalResponseFromOrchestratorInstruction(continued.stdout);
  assert.equal(terminalResponse.status, 'done');
});

test('runner CLI: write-output rejects --only-instructions', async () => {
  const workflowPath = path.join(tempDir, 'write-output-only-instructions-workflow.json');
  writeJson(workflowPath, workflowDoc);
  const { runId, runDir } = await runCase('write-output-only-instructions', workflowPath);

  const next = await runRunnerCli(['next', '--run-id', runId, '--workflow', workflowPath]);
  assert.equal(next.status, 0, next.stderr);
  const written = await runRunnerCli(['write-output', '--run-id', runId, '--step-id', 'prepare', '--only-instructions'], {
    input: JSON.stringify(workerOutput('prepared')),
  });
  assert.notEqual(written.status, 0);
  assert.match(written.stderr, /usage: bun \.\/lib\/entrypoints\/cli\/workflow-runner\.mjs/);
  const batonAfterWrite = JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
  assert.equal(Object.hasOwn(batonAfterWrite.state, 'prepare'), false);
});

test('runner CLI: pointer commands validate mode-specific arguments', async () => {
  const workflowPath = path.join(tempDir, 'pointer-cli-workflow.json');
  writeJson(workflowPath, pointerWorkflowDoc);
  const { runId } = await runCase('pointer-cli', workflowPath);

  const next = await runRunnerCli(['next', '--run-id', runId, '--workflow', workflowPath]);
  assert.equal(next.status, 0, next.stderr);
  const written = await runRunnerCli(['write-output', '--run-id', runId, '--step-id', 'prepare'], {
    input: JSON.stringify(workerOutput('prepared cli')),
    debugSummary: true,
  });
  assert.equal(written.status, 0, written.stderr);
  const continued = await runRunnerCli(['continue', '--run-id', runId, '--workflow', workflowPath]);
  assert.equal(continued.status, 0, continued.stderr);
  const leaseToken = leaseTokensByRunId.get(runId);

  const kebabList = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'list-pointer-transitions',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--lease-token', leaseToken,
  ], { cwd: root, encoding: 'utf8', env: process.env });
  assert.equal(kebabList.status, 0, kebabList.stderr);
  const listed = JSON.parse(kebabList.stdout);
  assert.equal(listed.transitions[0].to.cursor, 'prepare');

  const camelList = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'listPointerTransitions',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--lease-token', leaseToken,
  ], { cwd: root, encoding: 'utf8', env: process.env });
  assert.notEqual(camelList.status, 0);
  assert.match(camelList.stderr, /usage:/);

  const invalidList = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'list-pointer-transitions',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--lease-token', leaseToken,
    '--transition-id', listed.transitions[0].id,
  ], { cwd: root, encoding: 'utf8', env: process.env });
  assert.notEqual(invalidList.status, 0);
  assert.match(invalidList.stderr, /usage:/);

  const move = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'move-pointer',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--lease-token', leaseToken,
    '--transition-id', listed.transitions[0].id,
    '--acknowledge-retained-state',
  ], { cwd: root, encoding: 'utf8', env: process.env });
  assert.equal(move.status, 0, move.stderr);
  assert.equal(JSON.parse(move.stdout).current.cursor, 'prepare');

  const targetAliasMove = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'move-pointer',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--lease-token', leaseToken,
    '--target-position-id', listed.transitions[0].id,
    '--acknowledge-retained-state',
  ], { cwd: root, encoding: 'utf8', env: process.env });
  assert.notEqual(targetAliasMove.status, 0);
  assert.match(targetAliasMove.stderr, /usage:/);
});

test('runner CLI: errors do not expose raw workflow pathnames', async () => {
  const privateDir = path.join(tempDir, 'workflow-redaction-cli');
  mkdirSync(privateDir, { recursive: true });
  const workflowPath = path.join(privateDir, 'missing-private-cli-workflow.json');
  const runId = `workflow-runner-cli-test-${process.pid}-missing-cli-workflow`;

  const result = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'next',
    '--run-id', runId,
    '--workflow', workflowPath,
    '--lease-token', `redaction-cli-token-${process.pid}`,
  ], { cwd: root, encoding: 'utf8', env: process.env });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /failed to read workflow JSON: ENOENT|cannot read workflow: ENOENT/);
  assert.doesNotMatch(result.stderr, /missing-private-cli-workflow\.json/);
  assert.doesNotMatch(result.stderr, /workflow-redaction-cli/);
});

test('runner CLI redacts its exact lease credential from stderr', () => {
  const leaseToken = `unknown-run-token-${process.pid}`;
  const runsRoot = path.join(tempDir, 'credential-redaction-runs');
  const result = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'list-pointer-transitions', '--run-id', leaseToken, '--runs-root', runsRoot, '--lease-token', leaseToken,
  ], { cwd: root, encoding: 'utf8', env: process.env });
  assert.notEqual(result.status, 0);
  assert.equal(result.stderr.includes(leaseToken), false);
  assert.match(result.stderr, /redacted-lease-token|workflow run private state/);
});

test('runner CLI bounds stdin and orchestrator debug files before run authorization', () => {
  const runsRoot = path.join(tempDir, 'bounded-host-json-runs');
  const stdinRunId = `bounded-stdin-${process.pid}`;
  const stdinResult = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'write-output', '--run-id', stdinRunId, '--runs-root', runsRoot, '--step-id', 'prepare', '--lease-token', 'unused-token',
  ], { cwd: root, encoding: 'utf8', input: 'x'.repeat(HOST_JSON_INPUT_MAX_BYTES + 1), env: process.env });
  assert.notEqual(stdinResult.status, 0);
  assert.match(stdinResult.stderr, /host JSON stdin exceeds the 1048576-byte limit/);
  assert.equal(existsSync(resolveRunPaths({ runId: stdinRunId, runsRoot }).runDir), false);

  const debugRunId = `bounded-debug-${process.pid}`;
  const debugFile = path.join(tempDir, 'oversized-orchestrator-debug.json');
  writeFileSync(debugFile, 'x'.repeat(HOST_JSON_INPUT_MAX_BYTES + 1));
  const debugResult = spawnSync(process.execPath, [
    'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
    'continue', '--run-id', debugRunId, '--runs-root', runsRoot, '--orchestrator-debug-file', debugFile, '--lease-token', 'unused-token',
  ], { cwd: root, encoding: 'utf8', env: process.env });
  assert.notEqual(debugResult.status, 0);
  assert.match(debugResult.stderr, /orchestrator debug JSON file exceeds the 1048576-byte limit/);
  assert.equal(existsSync(resolveRunPaths({ runId: debugRunId, runsRoot }).runDir), false);
});

test('runner CLI rejects unsupported implicit next claim metadata explicitly', () => {
  for (const [flag, value] of [['--owner', 'qa'], ['--session-id', 'session-a'], ['--worker-id', 'worker-a']]) {
    const result = spawnSync(process.execPath, [
      'skills/orbita/lib/entrypoints/cli/workflow-runner.mjs',
      'next', '--run-id', `unsupported-next-${flag.slice(2)}-${process.pid}`, '--lease-token', 'unused-token', flag, value,
    ], { cwd: root, encoding: 'utf8', env: process.env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /supports implicit claim metadata only through harness/);
  }
});
