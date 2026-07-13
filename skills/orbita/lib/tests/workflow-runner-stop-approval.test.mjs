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

function recoverableApprovalWorkflow() {
  return {
    name: 'recoverable-approval',
    version: 1,
    start: 'prepare_approval',
    done: 'done',
    steps: {
      prepare_approval: {
        name: 'Prepare approval',
        kind: 'worker',
        input: { prompt: 'Prepare the release approval summary.' },
        output: { template: 'output.md' },
        next: 'approval_gate',
      },
      approval_gate: {
        name: 'Approval gate',
        kind: 'approval',
        input: { summary: '${{ input.prepare_approval.outcome }}' },
        next: { match: '${{ output.approval }}', cases: { approved: 'done', rejected: 'done' } },
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

test('runner reuse hints: approval non-blocking stop waits for orchestrator resolution before approval resumes', async () => {
  const workflow = recoverableApprovalWorkflow();
  const covered = schemaCoveredWorkflow();
  workflow.steps.prepare_approval.output.schema = covered.steps.prepare.output.schema;
  const { runId, runDir, workflowPath, leaseToken, now } = await runCase('non-blocking-stop-approval', workflow);

  const first = await next({ runId, workflowPath, leaseToken, now });
  assert.equal(first.requests[0].stepId, 'prepare_approval');
  assert.equal(first.requests[0].action, 'run_worker');
  await writeOutput({
    runId,
    workflowPath,
    stepId: 'prepare_approval',
    json: JSON.stringify(workerOutput('Approve the release.')),
    debugSummaryFile: debugSummaryFileFor(runDir, 'prepare_approval'),
    leaseToken,
    now,
  });
  const approval = await continueRun({ runId, workflowPath, leaseToken, now });
  assert.equal(approval.requests[0].stepId, 'approval_gate');
  assert.equal(approval.requests[0].action, 'wait_for_approval');
  assert.match(approval.orchestratorInstruction, /workflow-runner\.mjs' write-output --run-id/);
  assert.doesNotMatch(approval.orchestratorInstruction, /workflow-runner\.mjs' report-stop --run-id/);

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
