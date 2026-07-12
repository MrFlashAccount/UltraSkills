import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { continueRun, loadInstructions, next, reportStop, resolveStop, writeOutput } from './helpers/orbita-production-api.mjs';
import { WORKFLOW_RUNNER_COMMAND as workflowRunnerCommand } from '../runner/runner-command-builder.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { readRunAuthority } from '../persistence/run-state/run-authority.mjs';
import { registerWorkflowRunAtRoot } from '../persistence/run-state/workflow-runs.mjs';
import { publicNonBlockingStopDetails, publicStopResolutionDetails } from '../runtime/non-blocking-stop.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-runner-reuse-hints-'));
const testNow = new Date('2026-06-01T10:00:01.000Z');
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn markdown.\n');

const workflowDoc = {
  name: 'runner-reuse-hints-check',
  version: 1,
  start: 'prepare',
  done: 'done',
  steps: {
    prepare: {
      name: 'Prepare',
      kind: 'worker',
      input: { prompt: 'Prepare branch.' },
      output: { template: 'output.md' },
      next: 'branch_a',
    },
    branch_a: {
      name: 'Branch A',
      kind: 'worker',
      input: { prompt: 'Run branch A.' },
      output: { template: 'output.md' },
      next: 'branch_b',
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

function readBaton(runDir) {
  return JSON.parse(readFileSync(path.join(runDir, 'baton.json'), 'utf8'));
}

function workerOutput(summary) {
  return { outcome: 'ready', results: [{ type: 'check', summary }] };
}

function debugSummaryFileFor(runDir, stepId, text = `debug summary for ${stepId}\n`) {
  const filePath = path.join(runDir, stepId, 'debug-summary.md');
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, { flag: 'w' });
  return filePath;
}

function schemaCoveredWorkflow(overrides = {}) {
  const schemaPath = path.join(tempDir, `worker-output-${process.pid}-${Math.random().toString(16).slice(2)}.schema.json`);
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { type: 'string' },
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

function devHarnessImplementationSchema() {
  const schemaDir = path.join(tempDir, 'schemas');
  mkdirSync(schemaDir, { recursive: true });
  const schemaPath = path.join(schemaDir, 'implementation-output.json');
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { enum: ['implemented'] },
      summary: { type: 'string' },
      changed_files: { type: 'array' },
      verification: { type: 'array' },
      artifacts: { type: 'array' },
    },
    additionalProperties: false,
  });
  return path.basename(schemaPath);
}

function devHarnessImplementationWorkflow() {
  devHarnessImplementationSchema();
  const implementationOutput = { template: 'output.md', schema: 'schemas/implementation-output.json' };
  const steps = {
    backend_implementation: {
      name: 'Backend implementation',
      kind: 'worker',
      input: { prompt: 'Implement backend.' },
      output: implementationOutput,
      next: 'implementation_finalize',
    },
    implementation_finalize: {
      name: 'Implementation finalization',
      kind: 'worker',
      input: { prompt: 'Finalize implementation output.' },
      output: { template: 'output.md' },
      next: 'done',
    },
    done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
  };
  return {
    name: 'dev-harness',
    version: 1,
    start: 'backend_implementation',
    done: 'done',
    steps,
  };
}

function implementationArtifactPathFor(runDir, stepId, summary) {
  const filePath = path.join(runDir, stepId, 'artifacts', `implementation-handoff-${summary.replaceAll(/\W+/g, '-')}.md`);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${summary} handoff\n`, { flag: 'w' });
  return filePath;
}

function implementedOutput(summary, { artifactPath, ...extra } = {}) {
  if (!artifactPath) throw new Error('implementation artifact path is required');
  return {
    outcome: 'implemented',
    summary,
    changed_files: ['skills/orbita/lib/example.mjs'],
    verification: [{ command: 'node:test', result: 'passed' }],
    artifacts: [{
      id: 'implementation-handoff',
      content_type: 'text/markdown',
      path: artifactPath,
      summary: `${summary} handoff`,
    }],
    ...extra,
  };
}

function stopOutput(overrides = {}) {
  return {
    non_blocking_stop: {
      stop_id: '00000000-0000-4000-8000-000000000001',
      summary: 'Need approval before continuing.',
      source_step_id: 'backend_implementation',
      needed: 'Approve the smallest recovery question.',
      evidence: ['bounded public evidence'],
      risk: 'Continuing without approval would violate the plan.',
      ...overrides,
    },
  };
}

function resolutionOutput(overrides = {}) {
  const { stop_id = '00000000-0000-4000-8000-000000000001', ...resolutionOverrides } = overrides;
  return {
    stop_id,
    resolution: {
      summary: 'Approval was granted.',
      decision: 'Proceed with the smallest recovery question approved.',
      evidence: ['orchestrator resolution evidence'],
      ...resolutionOverrides,
    },
  };
}

test('non-blocking stop sanitizer preserves public URLs and redacts delimiter-independent private values', () => {
  const publicUrls = [
    'https://github.com/MrFlashAccount/UltraSkills/issues/252',
    'http://localhost:3000/help?step=worker',
  ];
  for (const value of publicUrls) {
    const stop = publicNonBlockingStopDetails({
      stop_id: '00000000-0000-4000-8000-000000000010',
      summary: value,
      needed: value,
    });
    assert.equal(stop.summary, value);
    assert.equal(stop.needed, value);
  }

  const privateValues = [
    { input: '[/home/alice/private.txt]', secret: '/home/alice/private.txt' },
    { input: 'path=[/home/alice/private.txt]', secret: '/home/alice/private.txt' },
    { input: 'source:/home/alice/private.txt', secret: '/home/alice/private.txt' },
    { input: '<~alice/.ssh/id_ed25519>', secret: '~alice/.ssh/id_ed25519' },
    { input: '[../../customer/private.csv]', secret: '../../customer/private.csv' },
    { input: 'dir/../../customer/private.csv', secret: '../../customer/private.csv' },
    { input: 'prefix/../private.txt', secret: '../private.txt' },
    { input: '[C:\\Users\\alice\\secret.txt]', secret: 'C:\\Users\\alice\\secret.txt' },
    { input: '[private file](/home/alice/private.txt)', secret: '/home/alice/private.txt' },
    { input: '"AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
    { input: "'AWS_SESSION_TOKEN': 'IQoJb3JpZ2luX2VjEJr//////////wEaCXVzLWVhc3QtMSJGMEQCID+a/b=='", secret: 'IQoJb3JpZ2luX2VjEJr//////////wEaCXVzLWVhc3QtMSJGMEQCID+a/b==' },
    { input: '{"service.auth.token":"abc/DEF+ghi=="}', secret: 'abc/DEF+ghi==' },
    { input: 'config["token"]="abc/DEF+ghi=="', secret: 'abc/DEF+ghi==' },
    { input: '`namespace_password` = `hunter2`', secret: 'hunter2' },
    { input: 'https://alice:hunter2@example.com/private', secret: 'hunter2' },
    { input: 'https://example.com/help?access_token=abc%2FDEF%2Bghi', secret: 'abc%2FDEF%2Bghi' },
  ];
  for (const { input, secret } of privateValues) {
    const stop = publicNonBlockingStopDetails({
      stop_id: '00000000-0000-4000-8000-000000000011',
      summary: input,
      needed: input,
    });
    const resolution = publicStopResolutionDetails({ summary: input, decision: input });
    assert.doesNotMatch(stop.summary, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `stop summary leaked: ${input}`);
    assert.doesNotMatch(stop.needed, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `stop needed leaked: ${input}`);
    assert.doesNotMatch(resolution.summary, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `resolution summary leaked: ${input}`);
    assert.doesNotMatch(resolution.decision, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `resolution decision leaked: ${input}`);
  }
});

function recoverableApprovalWorkflow() {
  return {
    name: 'recoverable-approval',
    version: 1,
    start: 'approval_gate',
    done: 'done',
    steps: {
      approval_gate: {
        name: 'Approval gate',
        kind: 'approval',
        input: { prompt: 'Approve the release.' },
        next: { match: '${{ output.approval }}', cases: { approved: 'done' } },
      },
      done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
    },
  };
}

async function runCase(label, workflow = workflowDoc, options = {}) {
  const workflowPath = path.join(tempDir, `${label}-workflow.json`);
  writeJson(workflowPath, workflow);
  const runId = `workflow-runner-reuse-hints-${process.pid}-${label}`;
  const paths = resolveRunPaths({ runId, workflowPath, runsRoot: options.runsRoot });
  rmSync(paths.runDir, { recursive: true, force: true });
  const claim = await registerWorkflowRunAtRoot({
    runId,
    workflowPath,
    runsRoot: options.runsRoot,
    claim: true,
    owner: 'test',
    harness: 'node-test',
    sessionId: label,
    now: new Date('2026-06-01T10:00:00.000Z'),
  });
  return { runId, runDir: paths.runDir, workflowPath, runsRoot: options.runsRoot, leaseToken: claim.leaseToken, now: testNow };
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

test('runner reuse hints: run_worker request exposes only approved reuse fields', async () => {
  const workflow = structuredClone(workflowDoc);
  workflow.steps.prepare.next = 'done';
  const { runId, workflowPath, leaseToken, now } = await runCase('single-request', workflow);

  const response = await next({ runId, workflowPath, leaseToken, now });
  const runsRoot = resolveRunPaths({ runId }).runsRoot;

  assert.equal(response.status, 'needs_host_actions');
  assert.match(response.orchestratorInstruction, /Current host requests:\n- run_worker: prepare/);
  assert.match(response.orchestratorInstruction, /Use the JSON response requests field as the machine-readable source when available/);
  assert.deepEqual(Object.keys(response.requests[0]).sort(), [
    'action',
    'id',
    'loadFollowupInstructionsCommand',
    'loadInstructionsCommand',
    'preferredAgentId',
    'stepId',
  ].sort());
  assert.equal(response.requests[0].preferredAgentId, null);
  assert.equal(response.requests[0].loadInstructionsCommand, `${workflowRunnerCommand} instructions --run-id '${runId}' --step-id 'prepare' --runs-root '${runsRoot}' --lease-token '${leaseToken}'`);
  assert.equal(response.requests[0].loadFollowupInstructionsCommand, `${workflowRunnerCommand} instructions --follow-up --run-id '${runId}' --step-id 'prepare' --runs-root '${runsRoot}' --lease-token '${leaseToken}'`);
});

test('runner reuse hints: follow-up instructions preserve validating output contract', async () => {
  const workflow = schemaCoveredWorkflow({ prepare: { next: 'done' } });
  const { runId, workflowPath, leaseToken, now } = await runCase('follow-up-instructions', workflow);
  await next({ runId, workflowPath, leaseToken, now });

  const fresh = await loadInstructions({ runId, workflowPath, stepId: 'prepare', leaseToken, now });
  const followUp = await loadInstructions({ runId, workflowPath, stepId: 'prepare', followUp: true, leaseToken, now });

  assert.ok(followUp.length < fresh.length, 'follow-up instructions should be more compact than fresh instructions');
  assert.match(followUp, /This follow-up omits the full template and schema/);
  assert.match(followUp, /Output schema: .*\.schema\.json/);
  assert.doesNotMatch(followUp, /"required": \[/);
  assert.doesNotMatch(followUp, /Return markdown\./);
  assert.match(followUp, /workflow-runner\.mjs' write-output --run-id/);
  assert.match(fresh, /workflow-runner\.mjs' report-stop --run-id/);
  assert.match(followUp, /workflow-runner\.mjs' report-stop --run-id/);
  assert.match(followUp, /--step-id 'prepare'/);
  assert.match(followUp, /--lease-token '[^']+'/);
  assert.doesNotMatch(followUp, /write-output[^\n]*--only-instructions/);
});

test('runner reuse hints: continue bind-agent flag stores top-level worker binding', async () => {
  const workflow = structuredClone(workflowDoc);
  workflow.steps.prepare.next = 'branch_a';
  workflow.steps.branch_a.next = 'done';
  const { runId, runDir, workflowPath, leaseToken, now } = await runCase('bind-agent-single', workflow);

  const first = await next({ runId, workflowPath, leaseToken, now });
  assert.equal(first.requests[0].preferredAgentId, null);
  await writeOutput({
    runId,
    workflowPath,
    stepId: 'prepare',
    json: JSON.stringify(workerOutput('prepared')),
    debugSummaryFile: debugSummaryFileFor(runDir, 'prepare'),
    leaseToken,
    now,
  });

  const response = await continueRun({ runId, workflowPath, bindAgents: ['prepare=worker-1'], leaseToken, now });
  assert.deepEqual(readBaton(runDir).workerBindings, { prepare: 'worker-1' });
  assert.equal(readBaton(runDir).state.workerBindings, undefined);
  assert.equal(response.requests[0].preferredAgentId, null);
});

test('runner reuse hints: logical agent name reuses one worker across different workflow steps', async () => {
  const workflow = structuredClone(workflowDoc);
  workflow.steps.prepare.agent = 'architect';
  workflow.steps.prepare.next = 'branch_a';
  workflow.steps.branch_a.agent = 'architect';
  workflow.steps.branch_a.next = 'done';
  const { runId, runDir, workflowPath, leaseToken, now } = await runCase('shared-agent-binding', workflow);

  const first = await next({ runId, workflowPath, leaseToken, now });
  assert.equal(first.requests[0].stepId, 'prepare');
  assert.equal(first.requests[0].preferredAgentId, null);

  await writeOutput({
    runId,
    workflowPath,
    stepId: 'prepare',
    json: JSON.stringify(workerOutput('prepared')),
    debugSummaryFile: debugSummaryFileFor(runDir, 'prepare'),
    leaseToken,
    now,
  });

  const followUp = await continueRun({ runId, workflowPath, bindAgents: ['prepare=architect-worker'], leaseToken, now });
  assert.deepEqual(readBaton(runDir).workerBindings, { architect: 'architect-worker' });
  assert.equal(followUp.requests[0].stepId, 'branch_a');
  assert.equal(followUp.requests[0].preferredAgentId, 'architect-worker');
});

test('runner reuse hints: continue bind-agent renews stale matching worker lease', async () => {
  const workflow = structuredClone(workflowDoc);
  workflow.steps.prepare.next = 'done';
  const { runId, workflowPath, leaseToken, now } = await runCase('bind-agent-renews-lease', workflow);
  const paths = resolveRunPaths({ runId, workflowPath });
  await next({ runId, workflowPath, leaseToken, now });
  await writeOutput({
    runId,
    workflowPath,
    stepId: 'prepare',
    json: JSON.stringify(workerOutput('prepared')),
    debugSummaryFile: debugSummaryFileFor(paths.runDir, 'prepare'),
    leaseToken,
    now,
  });
  const before = (await readRunAuthority(paths)).workerLease;
  assert.equal(before.leaseExpiresAt, '2026-06-01T11:00:01.000Z');

  await continueRun({
    runId,
    workflowPath,
    bindAgents: ['prepare=worker-after-expiry'],
    leaseToken,
    now: new Date('2026-06-01T11:05:00.000Z'),
  });

  const after = (await readRunAuthority(paths)).workerLease;
  assert.equal(after.tokenHash, before.tokenHash);
  assert.equal(after.tokenEpoch, before.tokenEpoch);
  assert.equal(after.leaseExpiresAt, '2026-06-01T12:05:00.000Z');
});


test('runner reuse hints: non-blocking stop keeps host work active with same-worker follow-up', async () => {
  const workflow = devHarnessImplementationWorkflow();
  const { runId, runDir, workflowPath, leaseToken, now } = await runCase('non-blocking-stop-same-worker', workflow);

  const first = await next({ runId, workflowPath, leaseToken, now });
  assert.equal(first.requests[0].stepId, 'backend_implementation');
  const reportedStopJson = JSON.stringify(stopOutput());
  await reportStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: reportedStopJson,
    leaseToken,
    now,
  });
  const historyAfterFirstReport = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  const duplicateBeforeResolution = await reportStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: reportedStopJson,
    leaseToken,
    now,
  });
  assert.equal(duplicateBeforeResolution.duplicate, true);
  assert.equal(readFileSync(path.join(runDir, 'history.md'), 'utf8'), historyAfterFirstReport);
  await assert.rejects(
    () => reportStop({
      runId,
      workflowPath,
      stepId: 'backend_implementation',
      json: JSON.stringify(stopOutput({ summary: 'Conflicting retry under the same stop id.' })),
      leaseToken,
      now,
    }),
    /conflicts with its previously accepted report/,
  );

  const recovery = await continueRun({ runId, workflowPath, bindAgents: ['backend_implementation=backend-worker-1'], leaseToken, now });

  assert.equal(recovery.status, 'needs_host_actions');
  assert.equal(recovery.baton.status, 'running');
  assert.equal(recovery.baton.cursor, 'backend_implementation');
  assert.equal(recovery.baton.state.backend_implementation, undefined);
  assert.equal(recovery.requests[0].stepId, 'backend_implementation');
  assert.equal(recovery.requests[0].action, 'resolve_non_blocking_stop');
  assert.match(recovery.requests[0].resolveStopCommand, /workflow-runner\.mjs' resolve-stop --run-id/);
  assert.equal(recovery.requests[0].nonBlockingStop.source_step_id, 'backend_implementation');
  assert.equal(recovery.requests[0].nonBlockingStop.needed, 'Approve the smallest recovery question.');

  await resolveStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: JSON.stringify(resolutionOutput()),
    leaseToken,
    now,
  });
  const batonAfterResolutionWrite = readBaton(runDir);
  assert.equal(
    batonAfterResolutionWrite.nonBlockingStops.backend_implementation.resolution.decision,
    'Proceed with the smallest recovery question approved.',
  );
  assert.equal(
    batonAfterResolutionWrite.state.backend_implementation,
    undefined,
  );
  const resolved = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(resolved.requests[0].action, 'run_worker');
  assert.equal(resolved.requests[0].preferredAgentId, 'backend-worker-1');
  assert.match(resolved.requests[0].loadInstructionsCommand, /workflow-runner\.mjs' instructions --run-id/);
  assert.match(resolved.requests[0].loadFollowupInstructionsCommand, /instructions --follow-up --run-id/);
  assert.equal(resolved.requests[0].nonBlockingStop.resolution.decision, 'Proceed with the smallest recovery question approved.');

  const historyAfterResolution = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  const delayedReplay = await reportStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: reportedStopJson,
    leaseToken,
    now,
  });
  assert.equal(delayedReplay.duplicate, true);
  assert.equal(readFileSync(path.join(runDir, 'history.md'), 'utf8'), historyAfterResolution);
  assert.equal(
    readBaton(runDir).nonBlockingStops.backend_implementation.resolution.decision,
    'Proceed with the smallest recovery question approved.',
  );
  const duplicateResolution = await resolveStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: JSON.stringify(resolutionOutput()),
    leaseToken,
    now,
  });
  assert.equal(duplicateResolution.duplicate, true);
  assert.equal(readFileSync(path.join(runDir, 'history.md'), 'utf8'), historyAfterResolution);
  await assert.rejects(
    () => resolveStop({
      runId,
      workflowPath,
      stepId: 'backend_implementation',
      json: JSON.stringify(resolutionOutput({ decision: 'Conflicting retry decision.' })),
      leaseToken,
      now,
    }),
    /conflicts with its previously accepted resolution/,
  );

  const followUpInstructions = await loadInstructions({ runId, workflowPath, stepId: 'backend_implementation', followUp: true, leaseToken, now });
  assert.match(followUpInstructions, /Implement backend\./);
  assert.match(followUpInstructions, /orchestrator has resolved it/i);
  assert.match(followUpInstructions, /Proceed with the smallest recovery question approved\./);

  const secondStopId = '00000000-0000-4000-8000-000000000009';
  await reportStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: JSON.stringify(stopOutput({
      stop_id: secondStopId,
      summary: 'A new problem needs a new resolution.',
      needed: 'Resolve the second problem.',
    })),
    leaseToken,
    now,
  });
  const secondRecovery = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(secondRecovery.requests[0].action, 'resolve_non_blocking_stop');
  assert.equal(secondRecovery.requests[0].nonBlockingStop.stop_id, secondStopId);
  await assert.rejects(
    () => resolveStop({
      runId,
      workflowPath,
      stepId: 'backend_implementation',
      json: JSON.stringify(resolutionOutput()),
      leaseToken,
      now,
    }),
    /does not match current stop/,
  );
  assert.equal(readBaton(runDir).nonBlockingStops.backend_implementation.resolution, undefined);
  await resolveStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: JSON.stringify(resolutionOutput({
      stop_id: secondStopId,
      summary: 'Second problem resolved.',
      decision: 'Continue after the second resolution.',
    })),
    leaseToken,
    now,
  });
  const secondResolved = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(secondResolved.requests[0].action, 'run_worker');
  assert.equal(secondResolved.requests[0].nonBlockingStop.resolution.decision, 'Continue after the second resolution.');

  await writeOutput({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: JSON.stringify(implementedOutput('backend recovered', {
      artifactPath: implementationArtifactPathFor(runDir, 'backend_implementation', 'backend recovered'),
    })),
    debugSummaryFile: debugSummaryFileFor(runDir, 'backend_implementation', 'recovered implementation\n'),
    leaseToken,
    now,
  });
  const joined = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(joined.status, 'needs_host_actions');
  assert.equal(joined.requests[0].stepId, 'implementation_finalize');

  await writeOutput({
    runId,
    workflowPath,
    stepId: 'implementation_finalize',
    json: JSON.stringify(workerOutput('joined')),
    debugSummaryFile: debugSummaryFileFor(runDir, 'implementation_finalize'),
    leaseToken,
    now,
  });
  const done = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(done.status, 'done');
});

test('runner reuse hints: any worker can report a non-blocking stop at the same request', async () => {
  const workflow = schemaCoveredWorkflow({ prepare: { next: 'done' } });
  const { runId, runDir, workflowPath, leaseToken, now } = await runCase('non-blocking-stop-generic-worker', workflow);

  const first = await next({ runId, workflowPath, leaseToken, now });
  assert.equal(first.requests[0].stepId, 'prepare');
  await assert.rejects(
    () => writeOutput({
      runId,
      workflowPath,
      stepId: 'prepare',
      json: JSON.stringify({ outcome: 'blocked' }),
      debugSummaryFile: debugSummaryFileFor(runDir, 'prepare'),
      leaseToken,
      now,
    }),
    /removed stop-as-output contract/,
  );
  assert.equal(readBaton(runDir).state.prepare, undefined);
  await assert.rejects(
    () => reportStop({
      runId,
      workflowPath,
      stepId: 'prepare',
      json: JSON.stringify({
        non_blocking_stop: {
          stop_id: '00000000-0000-4000-8000-000000000002',
          summary: 'Need a decision before continuing.',
          needed: 'Provide the missing decision.',
          resolution: { summary: 'Self-resolved.', decision: 'Continue.' },
        },
      }),
      leaseToken,
      now,
    }),
    /must not include resolution/,
  );
  assert.equal(readBaton(runDir).nonBlockingStops, undefined);
  await reportStop({
    runId,
    workflowPath,
    stepId: 'prepare',
    json: JSON.stringify({
      non_blocking_stop: {
        stop_id: '00000000-0000-4000-8000-000000000003',
        summary: 'Need a decision before continuing.',
        source_step_id: 'prepare',
        needed: 'Provide the missing decision.',
      },
    }),
    leaseToken,
    now,
  });

  const recovery = await continueRun({ runId, workflowPath, leaseToken, now });

  assert.equal(recovery.status, 'needs_host_actions');
  assert.equal(recovery.baton.status, 'running');
  assert.equal(recovery.baton.cursor, 'prepare');
  assert.equal(recovery.baton.state.prepare, undefined);
  assert.equal(recovery.requests[0].stepId, 'prepare');
  assert.equal(recovery.requests[0].action, 'resolve_non_blocking_stop');
  assert.equal(recovery.requests[0].nonBlockingStop.source_step_id, 'prepare');
  assert.equal(recovery.requests[0].nonBlockingStop.needed, 'Provide the missing decision.');
});

test('runner reuse hints: non-blocking stop has fresh-worker fallback without preferred worker', async () => {
  const workflow = devHarnessImplementationWorkflow();
  const { runId, runDir, workflowPath, leaseToken, now } = await runCase('non-blocking-stop-fresh-worker', workflow);

  await next({ runId, workflowPath, leaseToken, now });
  await reportStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: JSON.stringify(stopOutput()),
    leaseToken,
    now,
  });

  const recovery = await continueRun({ runId, workflowPath, leaseToken, now });

  assert.equal(recovery.requests[0].action, 'resolve_non_blocking_stop');
  assert.equal(recovery.requests[0].nonBlockingStop.summary, 'Need approval before continuing.');

  await resolveStop({
    runId,
    workflowPath,
    stepId: 'backend_implementation',
    json: JSON.stringify(resolutionOutput()),
    leaseToken,
    now,
  });
  const resolved = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(resolved.requests[0].action, 'run_worker');
  assert.equal(resolved.requests[0].preferredAgentId, null);
  assert.match(resolved.requests[0].loadInstructionsCommand, /instructions --run-id/);
  assert.match(resolved.requests[0].loadFollowupInstructionsCommand, /instructions --follow-up --run-id/);

  const freshInstructions = await loadInstructions({ runId, workflowPath, stepId: 'backend_implementation', leaseToken, now });
  assert.match(freshInstructions, /## Non-blocking stop/);
  assert.match(freshInstructions, /Approve the smallest recovery question\./);
  assert.match(freshInstructions, /bounded public evidence/);
  assert.match(freshInstructions, /The orchestrator has resolved it/);
  assert.match(freshInstructions, /Proceed with the smallest recovery question approved\./);
});


test('runner reuse hints: approval non-blocking stop waits for orchestrator resolution before approval resumes', async () => {
  const workflow = recoverableApprovalWorkflow();
  const { runId, runDir, workflowPath, leaseToken, now } = await runCase('non-blocking-stop-approval', workflow);

  const first = await next({ runId, workflowPath, leaseToken, now });
  assert.equal(first.requests[0].stepId, 'approval_gate');
  assert.equal(first.requests[0].action, 'wait_for_approval');
  assert.match(first.orchestratorInstruction, /workflow-runner\.mjs' report-stop --run-id/);

  await reportStop({
    runId,
    workflowPath,
    stepId: 'approval_gate',
    json: JSON.stringify({
      non_blocking_stop: {
        stop_id: '00000000-0000-4000-8000-000000000004',
        summary: 'Need orchestrator decision before approval can continue.',
        source_step_id: 'approval_gate',
        needed: 'Resolve approval concern.',
      },
    }),
    leaseToken,
    now,
  });

  const persistedAfterWrite = readBaton(runDir);
  assert.equal(persistedAfterWrite.state.approval_gate, undefined);
  assert.equal(persistedAfterWrite.nonBlockingStops.approval_gate.needed, 'Resolve approval concern.');

  const recovery = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(recovery.status, 'needs_host_actions');
  assert.equal(recovery.requests[0].stepId, 'approval_gate');
  assert.equal(recovery.requests[0].action, 'resolve_non_blocking_stop');
  assert.equal(recovery.requests[0].nonBlockingStop.needed, 'Resolve approval concern.');

  await resolveStop({
    runId,
    workflowPath,
    stepId: 'approval_gate',
    json: JSON.stringify(resolutionOutput({
      stop_id: '00000000-0000-4000-8000-000000000004',
      summary: 'Approval concern is resolved.',
      decision: 'Ask for approval again with the resolved concern.',
    })),
    leaseToken,
    now,
  });

  const resolved = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(resolved.status, 'needs_host_actions');
  assert.equal(resolved.requests[0].stepId, 'approval_gate');
  assert.equal(resolved.requests[0].action, 'wait_for_approval');
  assert.match(resolved.orchestratorInstruction, /Ask for approval again with the resolved concern\./);
});

test('runner reuse hints: non-blocking stop redacts private fields and sensitive text', async () => {
  const workflow = devHarnessImplementationWorkflow();
  const customRunsRoot = path.join(tempDir, 'non-blocking-stop-custom-runs-root');
  const { runId, runDir, workflowPath, runsRoot, leaseToken, now } = await runCase('non-blocking-stop-redaction', workflow, { runsRoot: customRunsRoot });
  const customIndexPath = path.join(customRunsRoot, 'runs.json');
  const customBatonPath = path.join(runDir, 'baton.json');
  const customHistoryPath = path.join(runDir, 'history.md');
  const desktopSecretPath = '/Users/sergeigarin/Desktop/secret.txt';
  const homeSecretPath = '/home/sergey/private.md';
  const tmpSecretPath = '/tmp/not-public/evidence.txt';

  await next({ runId, workflowPath, runsRoot, leaseToken, now });
  await reportStop({
    runId,
    workflowPath,
    runsRoot,
    stepId: 'backend_implementation',
    json: JSON.stringify(stopOutput({
      summary: `See https://github.com/MrFlashAccount/UltraSkills before continuing with token --lease-token ${leaseToken} from ${customIndexPath} and ${desktopSecretPath}.`,
      needed: `Inspect ${customBatonPath}, ${homeSecretPath}, [~/.ssh/id_ed25519], <~alice/.ssh/id_ed25519>, [file:///Users/alice/secret.txt], path[../../private/customer.csv], and [/home/alice/private.txt] before proceeding.`,
      evidence: [
        `${runDir}/.workflow-runner/durable-commit.json`,
        customHistoryPath,
        tmpSecretPath,
        '../../private/customer.csv',
        'AKIAIOSFODNN7EXAMPLE',
      ],
      risk: `Leaking ${customRunsRoot}, /private/var/folders/secret, password=hunter2, "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", 'AWS_SESSION_TOKEN': 'abc+def/ghi==', {"service.auth.token":"abc/DEF+ghi=="}, or \`namespace_password\` = \`hunter2\` would expose private run state.`,
      transcript: 'private transcript must not be projected',
      hidden_prompt: 'private prompt must not be projected',
      token: leaseToken,
    })),
    leaseToken,
    now,
  });

  const persistedAfterWrite = readBaton(runDir).nonBlockingStops.backend_implementation;
  const persistedText = JSON.stringify(persistedAfterWrite);
  assert.deepEqual(Object.keys(persistedAfterWrite).sort(), ['evidence', 'needed', 'risk', 'source_step_id', 'stop_id', 'summary'].sort());
  assert.doesNotMatch(persistedText, new RegExp(leaseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(persistedText, /private transcript/);
  assert.doesNotMatch(persistedText, /private prompt/);
  assert.doesNotMatch(persistedText, /\.workflow-runner/);
  assert.doesNotMatch(persistedText, /non-blocking-stop-custom-runs-root/);
  assert.doesNotMatch(persistedText, /runs\.json/);
  assert.doesNotMatch(persistedText, /baton\.json/);
  assert.doesNotMatch(persistedText, /history\.md/);
  assert.doesNotMatch(persistedText, /Desktop\/secret/);
  assert.doesNotMatch(persistedText, /\/home\/sergey/);
  assert.doesNotMatch(persistedText, /\/tmp\/not-public/);
  assert.doesNotMatch(persistedText, /\/private\/var/);
  assert.doesNotMatch(persistedText, /\.ssh|file:\/\/Users|\.\.\/\.\.\/private|\/home\/alice|AKIAIOSFODNN7EXAMPLE|hunter2|wJalrXUtnFEMI|abc\+def|abc\/DEF/);
  assert.match(persistedText, /https:\/\/github\.com\/MrFlashAccount\/UltraSkills/);
  assert.match(persistedText, /local filesystem path/);

  const recovery = await continueRun({ runId, workflowPath, runsRoot, leaseToken, now });
  const projected = recovery.requests[0].nonBlockingStop;
  const projectedText = JSON.stringify(projected);

  assert.doesNotMatch(projectedText, new RegExp(leaseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(projectedText, /private transcript/);
  assert.doesNotMatch(projectedText, /private prompt/);
  assert.doesNotMatch(projectedText, /\.workflow-runner/);
  assert.doesNotMatch(projectedText, /non-blocking-stop-custom-runs-root/);
  assert.doesNotMatch(projectedText, /runs\.json/);
  assert.doesNotMatch(projectedText, /baton\.json/);
  assert.doesNotMatch(projectedText, /history\.md/);
  assert.doesNotMatch(projectedText, /Desktop\/secret/);
  assert.doesNotMatch(projectedText, /\/home\/sergey/);
  assert.doesNotMatch(projectedText, /\/tmp\/not-public/);
  assert.doesNotMatch(projectedText, /\/private\/var/);
  assert.match(projected.summary, /\[redacted-lease-token\]/);
  assert.match(projected.summary, /https:\/\/github\.com\/MrFlashAccount\/UltraSkills/);
  assert.match(projected.summary, /workflow runs index/);
  assert.match(projected.summary, /local filesystem path/);
  assert.match(projected.needed, /workflow baton private state/);
  assert.match(projected.evidence.join(' '), /workflow history private state/);
  assert.deepEqual(Object.keys(projected).sort(), ['evidence', 'needed', 'risk', 'source_step_id', 'stop_id', 'summary'].sort());

  await resolveStop({
    runId,
    workflowPath,
    runsRoot,
    stepId: 'backend_implementation',
    json: JSON.stringify(resolutionOutput({
      summary: `Resolved via https://example.com/help after checking <${desktopSecretPath}>.`,
      decision: `Continue after reading [${homeSecretPath}] with "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY".`,
      evidence: [`[${tmpSecretPath}]`, '[C:\\Users\\alice\\secret.txt]'],
    })),
    leaseToken,
    now,
  });

  const persistedResolutionAfterWrite = readBaton(runDir).nonBlockingStops.backend_implementation.resolution;
  const persistedResolutionText = JSON.stringify(persistedResolutionAfterWrite);
  assert.doesNotMatch(persistedResolutionText, /Desktop\/secret/);
  assert.doesNotMatch(persistedResolutionText, /\/home\/sergey/);
  assert.doesNotMatch(persistedResolutionText, /\/tmp\/not-public/);
  assert.doesNotMatch(persistedResolutionText, /wJalrXUtnFEMI|C:\\Users/);
  assert.match(persistedResolutionText, /local filesystem path/);
  assert.match(persistedResolutionText, /https:\/\/example\.com\/help/);
  const historyText = readFileSync(path.join(runDir, 'history.md'), 'utf8');
  assert.doesNotMatch(historyText, /See https|Inspect .*before proceeding|Resolved via|Continue after reading/);
});

test('runner reuse hints: write-output rejects binding metadata and preserves workerBindings', async () => {
  const workflow = structuredClone(workflowDoc);
  workflow.steps.prepare.next = 'branch_a';
  workflow.steps.branch_a.next = 'done';
  const { runId, runDir, workflowPath, leaseToken, now } = await runCase('write-output-purity', workflow);
  await next({ runId, workflowPath, leaseToken, now });
  await writeOutput({
    runId,
    workflowPath,
    stepId: 'prepare',
    json: JSON.stringify(workerOutput('prepared')),
    debugSummaryFile: debugSummaryFileFor(runDir, 'prepare'),
    leaseToken,
    now,
  });
  await continueRun({ runId, workflowPath, bindAgents: ['prepare=worker-before-output'], leaseToken, now });

  await assert.rejects(
    () => writeOutput({
      runId,
      workflowPath,
      stepId: 'branch_a',
      json: JSON.stringify({ outcome: 'ready', workerBindings: { prepare: 'bad-worker' } }),
      leaseToken,
      now,
    }),
    /output schema validation failed/,
  );
  assert.deepEqual(readBaton(runDir).workerBindings, { prepare: 'worker-before-output' });

  await writeOutput({
    runId,
    workflowPath,
    stepId: 'branch_a',
    json: JSON.stringify(workerOutput('accepted without binding mutation')),
    debugSummaryFile: debugSummaryFileFor(runDir, 'branch_a'),
    leaseToken,
    now,
  });
  assert.deepEqual(readBaton(runDir).workerBindings, { prepare: 'worker-before-output' });
  assert.equal(readBaton(runDir).state.branch_a.results[0].summary, 'accepted without binding mutation');
});
