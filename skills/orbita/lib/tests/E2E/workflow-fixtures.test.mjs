import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { resolveRunPaths } from '../../persistence/run-state/paths.mjs';
import { registerWorkflowRun } from '../helpers/orbita-production-api.mjs';
import { runWorkflowRunnerApi } from '../helpers/workflow-runner-api-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixturesDir = path.join(root, 'skills/orbita/lib/tests/E2E/fixtures');
const outputsDir = path.join(fixturesDir, 'outputs');
const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-e2e-fixtures-'));
const runsRoot = path.join(tempDir, 'runs');
let runCounter = 0;
const leaseTokensByRunId = new Map();

function fixture(name) {
  return path.join(fixturesDir, name);
}

function output(name) {
  return path.join(outputsDir, name);
}

function runDir(label) {
  runCounter += 1;
  const runId = `workflow-e2e-${process.pid}-${runCounter}-${label}`;
  const runDir = resolveRunPaths({ runId, runsRoot }).runDir;
  rmSync(runDir, { recursive: true, force: true });
  return { runId, runDir };
}

function runId(run) {
  return typeof run === 'string' ? run : run.runId;
}

function runPath(run) {
  return typeof run === 'string' ? run : run.runDir;
}

function valueAfter(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function claimRunForRunnerArgs(args) {
  const runIdValue = valueAfter(args, '--run-id');
  if (!runIdValue) return undefined;
  const known = leaseTokensByRunId.get(runIdValue);
  if (known) return known;
  const workflow = valueAfter(args, '--workflow');
  const created = await registerWorkflowRun({ runId: runIdValue, workflowPath: workflow, runsRoot, claim: true });
  const token = created.leaseToken;
  leaseTokensByRunId.set(runIdValue, token);
  return token;
}

function withLeaseToken(args, token) {
  if (!token || args.includes('--lease-token')) return args;
  return [...args, '--lease-token', token];
}

async function runRunner(args, options = {}) {
  const token = await claimRunForRunnerArgs(args);
  return runWorkflowRunnerApi([...withLeaseToken(args, token), '--runs-root', runsRoot], options);
}

async function expectRunner(args, label) {
  const result = await runRunner(args);
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function next(run, workflow, extra = []) {
  return expectRunner(['next', '--run-id', runId(run), '--workflow', workflow, ...extra], `next ${path.basename(workflow)}`);
}

async function currentRequests(run, workflow) {
  const response = await next(run, workflow);
  return response.requests ?? [];
}

function parseOutputRef(ref) {
  const separator = ref.indexOf('=');
  if (separator < 0) return { stepId: undefined, filePath: ref };
  return { stepId: ref.slice(0, separator), filePath: ref.slice(separator + 1) };
}

async function writeOutput(run, workflow, stepId, filePath, { action, label = 'write output' } = {}) {
  const outputJson = readFileSync(filePath, 'utf8').replaceAll('__RUN_DIR__', runPath(run));
  const args = ['write-output', '--run-id', runId(run), '--workflow', workflow, '--step-id', stepId];
  if (action === 'run_worker') {
    const debugSummaryPath = path.join(runPath(run), stepId, 'debug-summary.md');
    mkdirSync(path.dirname(debugSummaryPath), { recursive: true });
    writeFileSync(debugSummaryPath, `debug summary for ${stepId}\n`);
    args.push('--debug-summary-file', debugSummaryPath);
  }
  const result = await runRunner(args, {
    input: outputJson,
  });
  assert.equal(result.status, 0, `${label} failed
stdout:
${result.stdout}
stderr:
${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function continueWith(run, workflow, refs, label = 'continue') {
  const normalized = Array.isArray(refs) ? refs : [refs];
  const pendingRequests = await currentRequests(run, workflow);
  const pendingIds = pendingRequests.map((request) => request.stepId ?? request.id);
  for (const ref of normalized) {
    const { stepId, filePath } = parseOutputRef(ref);
    const targetStepId = stepId ?? (pendingIds.length === 1 ? pendingIds[0] : undefined);
    assert.ok(targetStepId, `output for ${label} must name a step when multiple requests are pending`);
    const request = pendingRequests.find((item) => (item.stepId ?? item.id) === targetStepId);
    await writeOutput(run, workflow, targetStepId, filePath, { action: request?.action, label: `${label} write ${targetStepId}` });
  }
  return expectRunner(['continue', '--run-id', runId(run), '--workflow', workflow], label);
}

async function instructions(run, stepId) {
  const result = await runRunner(['instructions', '--run-id', runId(run), '--step-id', stepId]);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function readBaton(run) {
  return JSON.parse(readFileSync(path.join(runPath(run), 'baton.json'), 'utf8'));
}

function readHistory(run) {
  return readFileSync(path.join(runPath(run), 'history.md'), 'utf8');
}

function writeRunArtifact(run, artifactPath, content) {
  const fullPath = path.join(runPath(run), artifactPath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

test('E2E fixture: long happy path loops through review revision and preserves latest state', async () => {
  const workflow = fixture('long-revision.workflow.json');
  const run = runDir('long-revision');

  const first = await next(run, workflow);
  assert.equal(first.status, 'needs_host_actions');
  assert.deepEqual(first.requests.map((request) => request.id), ['plan']);
  assert.match(await instructions(run, 'plan'), /# Plan/);

  writeRunArtifact(run, 'plan/artifacts/plan.md', 'Plan artifact content for approval.\n');
  const planned = await continueWith(run, workflow, output('plan-ready.json'), 'continue plan');
  assert.equal(planned.baton.cursor, 'approval_gate');
  assert.equal(planned.requests[0].action, 'wait_for_approval');
  assert.equal(planned.baton.state.plan.artifacts[0].summary, 'plan v1');
  const approvalInstructions = await instructions(run, 'approval_gate');
  assert.doesNotMatch(approvalInstructions, /## Required reads/);
  assert.match(approvalInstructions, /## Approval attachments/);
  assert.match(approvalInstructions, /\[plan\]\(<.*plan\/artifacts\/plan\.md>\) — text\/markdown/);
  assert.match(approvalInstructions, /plan\/artifacts\/plan\.md/);
  assert.doesNotMatch(approvalInstructions, /Plan artifact content for approval\./);

  const approved = await continueWith(run, workflow, output('approval-approved.json'), 'continue approval');
  assert.equal(approved.baton.cursor, 'implement');
  assert.equal(approved.baton.state.approval_gate.approval, 'approved');
  const implementInstructions = await instructions(run, 'implement');
  assert.match(implementInstructions, /Approval decision:/);
  assert.match(implementInstructions, /"approval"\s*:\s*"approved"/);

  assert.equal((await continueWith(run, workflow, output('implement-v1.json'), 'continue implementation v1')).baton.cursor, 'review');
  const revision = await continueWith(run, workflow, output('review-retry.json'), 'continue review retry');
  assert.equal(revision.baton.cursor, 'implement');
  assert.equal(revision.baton.state.review.results[0].summary, 'needs revision');

  assert.equal((await continueWith(run, workflow, output('implement-v2.json'), 'continue implementation v2')).baton.cursor, 'review');
  const done = await continueWith(run, workflow, output('review-ready.json'), 'continue review ready');
  assert.equal(done.status, 'done');
  assert.equal(done.baton.cursor, 'done');
  assert.equal(done.baton.state.implement.results[0].summary, 'implementation v2');
  assert.equal(done.baton.state.results.at(-1).summary, 'accepted');
  assert.match(readHistory(run), /id=review action=run_worker/);
});

test('E2E fixture: DevHarness-style artifact path is required-read context for downstream review instructions', async () => {
  const workflow = fixture('long-revision.workflow.json');
  const run = runDir('artifact-content');

  await next(run, workflow);
  writeRunArtifact(run, 'plan/artifacts/plan.md', 'Plan artifact content for approval.\n');
  await continueWith(run, workflow, output('plan-ready.json'), 'continue plan for artifact content');
  await continueWith(run, workflow, output('approval-approved.json'), 'continue approval for artifact content');

  writeRunArtifact(run, 'implement/artifacts/packet.md', 'Concrete implementation artifact content for reviewer.\n');
  const implementOutputPath = path.join(tempDir, 'implement-with-readable-artifact.json');
  writeFileSync(implementOutputPath, `${JSON.stringify({
    outcome: 'ready',
    results: [{ type: 'implementation', summary: 'implementation with readable artifact' }],
    artifacts: [{ id: 'packet', content_type: 'text/markdown', path: path.join(runPath(run), 'implement/artifacts/packet.md'), summary: 'readable packet' }],
  }, null, 2)}\n`);

  const reviewRequest = await continueWith(run, workflow, implementOutputPath, 'continue implementation readable artifact');
  assert.equal(reviewRequest.baton.cursor, 'review');
  const reviewInstructions = await instructions(run, 'review');
  assert.match(reviewInstructions, /## Required reads/);
  assert.match(reviewInstructions, /Prompt input artifact 'packet' from 'implement' \(text\/markdown\):/);
  assert.match(reviewInstructions, /implement\/artifacts\/packet\.md/);
  assert.doesNotMatch(reviewInstructions, /Concrete implementation artifact content for reviewer\./);
});

test('E2E fixture: match route covers retry loop', async () => {
  const workflow = fixture('route-retry.workflow.json');
  const retryRun = runDir('route-retry');

  assert.deepEqual((await next(retryRun, workflow)).requests.map((request) => request.id), ['triage']);
  const retry = await continueWith(retryRun, workflow, output('triage-retry.json'), 'continue triage retry');
  assert.equal(retry.status, 'needs_host_actions');
  assert.equal(retry.baton.cursor, 'triage');
  assert.equal(Object.hasOwn(retry.baton.state, 'triage'), false);
  assert.equal(retry.baton.state.results.at(-1).summary, 'needs another pass');

  const ready = await continueWith(retryRun, workflow, output('triage-ready.json'), 'continue triage ready');
  assert.equal(ready.baton.cursor, 'resolve');
  assert.match(await instructions(retryRun, 'resolve'), /ready for resolution/);
  const done = await continueWith(retryRun, workflow, output('worker-ready.json'), 'continue resolve ready');
  assert.equal(done.status, 'done');

});

test('E2E fixture: fanout owner persists named branch outputs before owner completion', async () => {
  const workflow = fixture('fanout-owner.workflow.json');
  const run = runDir('fanout-owner');

  await next(run, workflow);
  const branched = await continueWith(run, workflow, output('prepare-ready.json'), 'continue prepare fanout');
  assert.equal(branched.status, 'needs_host_actions');
  assert.equal(branched.baton.cursor, 'checks');
  assert.deepEqual(branched.requests.map((request) => request.id), ['checks__fanout__1__lint', 'checks__fanout__1__build']);
  assert.equal(branched.baton.state.prepare.results[0].summary, 'fanout ready');
  assert.match(await instructions(run, 'checks__fanout__1__lint'), /fanout ready/);

  const joined = await continueWith(run, workflow, [
    `checks__fanout__1__lint=${output('lint-ready.json')}`,
    `checks__fanout__1__build=${output('build-ready.json')}`,
  ], 'continue named branches');
  assert.equal(joined.baton.cursor, 'checks');
  assert.equal(joined.baton.state.lint.results[0].summary, 'lint clean');
  assert.equal(joined.baton.state.build.results[0].summary, 'build green');
  const ownerInstructions = await instructions(run, 'checks');
  assert.match(ownerInstructions, /lint clean/);
  assert.match(ownerInstructions, /build green/);

  const done = await continueWith(run, workflow, output('owner-ready.json'), 'continue owner');
  assert.equal(done.status, 'done');
  assert.match(readHistory(run), /accepted:checks__fanout__1__lint/);
});

test('E2E fixture: output schema rejects invalid write-output and valid output advances', async () => {
  const workflow = fixture('schema-retry.workflow.json');
  const run = runDir('schema-retry');

  await next(run, workflow);
  const invalid = await runRunner(['write-output', '--run-id', runId(run), '--workflow', workflow, '--step-id', 'schema_worker'], {
    input: readFileSync(output('schema-invalid.json'), 'utf8'),
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /output schema validation failed for step 'schema_worker'/);

  const valid = await continueWith(run, workflow, output('schema-valid.json'), 'continue valid schema');
  assert.equal(valid.status, 'done');
  assert.equal(valid.baton.state.schema_worker.ticket, 'TCK-123');
});

test('E2E fixture: typed approval after the startup worker preserves the prompt only for that worker through fanout and final approval', async () => {
  const workflow = fixture('approval-first-fanout.workflow.json');
  const run = runDir('approval-first');
  const userPrompt = 'Original startup request. Preserve this only for prepare.';

  const preparedRequest = await next(run, workflow, ['--user-prompt', userPrompt]);
  assert.equal(preparedRequest.requests[0].id, 'prepare');
  assert.equal(preparedRequest.baton.user_prompt, userPrompt);
  assert.equal(preparedRequest.baton.user_prompt_target, 'prepare');
  const prepareInstructions = await instructions(run, 'prepare');
  assert.match(prepareInstructions, /## User prompt/);
  assert.match(prepareInstructions, /Original startup request/);

  const intake = await continueWith(run, workflow, output('prepare-ready.json'), 'continue prepare to typed intake approval');
  assert.equal(intake.baton.cursor, 'intake_approval');
  assert.equal(intake.baton.user_prompt_injected, true);
  assert.doesNotMatch(await instructions(run, 'intake_approval'), /Original startup request/);

  const fanout = await continueWith(run, workflow, output('approval-approved.json'), 'continue intake approval');
  assert.equal(fanout.baton.cursor, 'implementation');
  assert.deepEqual(fanout.requests.map((request) => request.id), ['implementation__fanout__1__branch_a', 'implementation__fanout__1__branch_b']);
  assert.doesNotMatch(await instructions(run, 'implementation__fanout__1__branch_a'), /Original startup request/);
  assert.doesNotMatch(await instructions(run, 'implementation__fanout__1__branch_b'), /Original startup request/);

  const joinedRequest = await continueWith(run, workflow, [
    `implementation__fanout__1__branch_a=${output('lint-ready.json')}`,
    `implementation__fanout__1__branch_b=${output('build-ready.json')}`,
  ], 'continue approval-first branches');
  assert.equal(joinedRequest.baton.cursor, 'implementation');
  assert.doesNotMatch(await instructions(run, 'implementation'), /Original startup request/);

  const finalApproval = await continueWith(run, workflow, output('owner-ready.json'), 'continue approval-first owner');
  assert.equal(finalApproval.baton.cursor, 'final_approval');
  assert.equal(finalApproval.requests[0].action, 'wait_for_approval');
  assert.match(await instructions(run, 'final_approval'), /## Current summary\n\nready/);

  const done = await continueWith(run, workflow, output('approval-approved.json'), 'continue final approval');
  assert.equal(done.status, 'done');
  assert.equal(done.baton.user_prompt, userPrompt);
  assert.equal(done.baton.user_prompt_injected, true);
});

test('E2E fixture: loopPolicies exhaust approval and implementation revision loops', async () => {
  const workflow = fixture('loop-policies-approval-revision.workflow.json');

  const approvalRun = runDir('loop-policy-approval-revision');
  await next(approvalRun, workflow);
  assert.equal((await continueWith(approvalRun, workflow, output('plan-ready.json'), 'continue approval revision plan v1')).baton.cursor, 'approval_gate');
  assert.deepEqual(readBaton(approvalRun).state.$loopProgress, { approval_revision: 1 });

  const rejected = await continueWith(approvalRun, workflow, output('approval-rejected.json'), 'continue approval rejected');
  assert.equal(rejected.baton.cursor, 'plan');
  assert.deepEqual(rejected.baton.state.$loopProgress, { approval_revision: 1 });

  const secondApproval = await continueWith(approvalRun, workflow, output('plan-ready.json'), 'continue approval revision plan v2');
  assert.equal(secondApproval.baton.cursor, 'approval_gate');
  assert.deepEqual(secondApproval.baton.state.$loopProgress, { approval_revision: 2 });

  const exhaustedApproval = await continueWith(approvalRun, workflow, output('approval-rejected.json'), 'continue approval revision exhaustion');
  assert.equal(exhaustedApproval.status, 'done');
  assert.equal(exhaustedApproval.baton.cursor, 'limit_reached');
  assert.deepEqual(exhaustedApproval.baton.state.$loopProgress, { approval_revision: 2 });

  const implementationRun = runDir('loop-policy-implementation-revision');
  await next(implementationRun, workflow);
  await continueWith(implementationRun, workflow, output('plan-ready.json'), 'continue implementation revision plan');
  await continueWith(implementationRun, workflow, output('approval-approved.json'), 'continue implementation revision approval');

  assert.equal((await continueWith(implementationRun, workflow, output('implement-v1.json'), 'continue implementation revision v1')).baton.cursor, 'review');
  assert.deepEqual(readBaton(implementationRun).state.$loopProgress, { approval_revision: 1, implementation_revision: 1 });

  const revision = await continueWith(implementationRun, workflow, output('review-retry.json'), 'continue implementation revision retry');
  assert.equal(revision.baton.cursor, 'implement');
  assert.deepEqual(revision.baton.state.$loopProgress, { approval_revision: 1, implementation_revision: 1 });

  const secondReview = await continueWith(implementationRun, workflow, output('implement-v2.json'), 'continue implementation revision v2');
  assert.equal(secondReview.baton.cursor, 'review');
  assert.deepEqual(secondReview.baton.state.$loopProgress, { approval_revision: 1, implementation_revision: 2 });

  const exhaustedImplementation = await continueWith(implementationRun, workflow, output('review-retry.json'), 'continue implementation revision exhaustion');
  assert.equal(exhaustedImplementation.status, 'done');
  assert.equal(exhaustedImplementation.baton.cursor, 'limit_reached');
  assert.deepEqual(exhaustedImplementation.baton.state.$loopProgress, { approval_revision: 1, implementation_revision: 2 });
});

test('E2E fixture: loopPolicies exhaust self-loop workflow', async () => {
  const workflow = fixture('loop-policies-self-loop.workflow.json');
  const run = runDir('loop-policy-self-loop');

  await next(run, workflow);
  const firstRetry = await continueWith(run, workflow, output('self-retry.json'), 'continue self-loop retry 1');
  assert.equal(firstRetry.baton.cursor, 'self_check');
  assert.deepEqual(firstRetry.baton.state.$loopProgress, { self_check: 1 });

  const secondRetry = await continueWith(run, workflow, output('self-retry.json'), 'continue self-loop retry 2');
  assert.equal(secondRetry.baton.cursor, 'limit_reached');
  assert.equal(secondRetry.status, 'done');
  assert.deepEqual(secondRetry.baton.state.$loopProgress, { self_check: 2 });
});
