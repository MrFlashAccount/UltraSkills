import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { toHostResponse } from '../entrypoints/internal/runner/host-requests.mjs';
import { loadInstructions as runnerLoadInstructions, next as runnerNext } from '../entrypoints/workflow-runner-command.mjs';
import { assertRunnerHostResponseSchema } from '../persistence/run-state/schema/runner-host-response-schema.mjs';
import { loadWorkflowRuntime } from '../persistence/workflow-resources/runtime-reader.mjs';
import { runNext } from '../use-cases/RunNext.mjs';
import { loadInstructions as validateLoadInstructions } from '../use-cases/LoadInstructions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-sharding-check-'));
writeFileSync(path.join(tempDir, 'output.md'), '## Output contract\nReturn strict JSON.\n');
for (const role of ['backend', 'security']) {
  const roleDir = path.join(tempDir, 'roles', role);
  mkdirSync(roleDir, { recursive: true });
  writeFileSync(path.join(roleDir, 'ROLE.md'), `# ${role}\n`);
  writeFileSync(path.join(roleDir, 'RUBRIC.md'), `# ${role} rubric\n`);
}
writeFileSync(path.join(tempDir, 'sharded-output.schema.json'), `${JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['outcome', 'shard_id', 'reviewer_role'],
  properties: {
    outcome: { enum: ['ready', 'blocked'] },
    shard_id: { type: 'string' },
    reviewer_role: { type: 'string' },
    results: { type: 'array' },
    artifacts: { type: 'array' },
  },
  additionalProperties: false,
}, null, 2)}\n`);

const emptyState = { artifacts: [], results: [] };

function outputContract() {
  return { template: 'output.md', schema: 'sharded-output.schema.json' };
}

function shardedWorkflow(overrides = {}) {
  const workflow = {
    name: 'sharded-spec',
    version: 1,
    start: 'review_owner',
    done: 'done',
    steps: {
      review_owner: {
        name: 'Review owner',
        kind: 'worker',
        input: { prompt: 'Review this slice.' },
        output: outputContract(),
        sharding: {
          enabled: true,
          mode: 'review_shards',
          obligations: [
            { shard_id: 'backend', reviewer_role: 'backend', required: true, source_evidence: ['contract row B'] },
            { shard_id: 'security', reviewer_role: 'security', required: false, source_evidence: ['contract row D'] },
          ],
        },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done', input: { prompt: 'Finished.' } },
    },
  };
  return { ...workflow, ...overrides, steps: { ...workflow.steps, ...(overrides.steps ?? {}) } };
}

function baton(overrides = {}) {
  return {
    cursor: 'review_owner',
    status: 'running',
    state: structuredClone(emptyState),
    ...overrides,
  };
}

function shardOutput(shardId, role, overrides = {}) {
  return {
    outcome: 'ready',
    shard_id: shardId,
    reviewer_role: role,
    results: [{ type: 'shard', summary: `${role}:${shardId}` }],
    ...overrides,
  };
}

function safeName(label) {
  return label.replace(/[^a-z0-9_-]+/gi, '-');
}

function writeJson(fileName, value) {
  const filePath = path.join(tempDir, fileName);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function runNode(args, cwd = root) {
  return spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
}

function expectCliResult(label, result, expectSuccess) {
  const succeeded = result.status === 0;
  assert.equal(
    succeeded,
    expectSuccess,
    `check '${label}' expected ${expectSuccess ? 'success' : 'failure'} but got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  if (!expectSuccess) return { stdout: result.stdout, stderr: result.stderr };
  return JSON.parse(result.stdout);
}

function runInspect(label, workflowDoc, expectSuccess = true) {
  const prefix = safeName(label);
  const batonPath = writeJson(`${prefix}-baton.json`, baton());
  const wfPath = writeJson(`${prefix}-workflow.json`, workflowDoc);
  return expectCliResult(label, runNode(['skills/orbita/lib/tests/helpers/workflow-runtime-harness.mjs', 'inspect', wfPath, batonPath]), expectSuccess);
}

function runRender(label, workflowDoc = shardedWorkflow()) {
  const prefix = safeName(label);
  const batonPath = writeJson(`${prefix}-baton.json`, baton());
  const wfPath = writeJson(`${prefix}-workflow.json`, workflowDoc);
  return expectCliResult(label, runNode(['skills/orbita/lib/tests/helpers/workflow-runtime-harness.mjs', 'render', wfPath, batonPath]), true);
}

function runApply(label, workerOutput, workflowDoc = shardedWorkflow(), expectSuccess = true) {
  const prefix = safeName(label);
  const batonPath = writeJson(`${prefix}-baton.json`, baton());
  const wfPath = writeJson(`${prefix}-workflow.json`, workflowDoc);
  const outputPath = writeJson(`${prefix}-output.json`, workerOutput);
  return expectCliResult(label, runNode(['skills/orbita/lib/tests/helpers/workflow-runtime-harness.mjs', 'apply', wfPath, batonPath, outputPath]), expectSuccess);
}

function runApplyFromBaton(label, batonDoc, workerOutput, workflowDoc = shardedWorkflow(), expectSuccess = true) {
  const prefix = safeName(label);
  const batonPath = writeJson(`${prefix}-baton.json`, batonDoc);
  const wfPath = writeJson(`${prefix}-workflow.json`, workflowDoc);
  const outputPath = writeJson(`${prefix}-output.json`, workerOutput);
  return expectCliResult(label, runNode(['skills/orbita/lib/tests/helpers/workflow-runtime-harness.mjs', 'apply', wfPath, batonPath, outputPath]), expectSuccess);
}

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

test('sharding: render exposes safe shard request entries without changing baton cursor', () => {
  const response = runRender('sharded-render');

  assert.deepEqual(response.steps.map((step) => step.id), ['review_owner__shard__backend', 'review_owner__shard__security']);
  assert.deepEqual(response.steps.map((step) => step.ownerStepId), ['review_owner', 'review_owner']);
  assert.equal(response.baton.cursor, 'review_owner');
  assert.equal(response.steps[0].shard.obligation_id, 'review_owner:backend');
  assert.equal(response.steps[0].shard.reviewer_role, 'backend');
  assert.equal(response.steps[0].shard.privacy_route, 'safe_context');
  assert.equal('leaseToken' in response.steps[0].shard, false);
  assert.equal('request_id' in response.steps[0].shard, false);
  assert.equal('attempts' in response.steps[0].shard, false);
});

test('sharding: public host requests expose owner step and safe obligation fields only', () => {
  const wfPath = writeJson('host-request-workflow.json', shardedWorkflow());
  const batonPath = writeJson('host-request-baton.json', baton());
  const runtime = loadWorkflowRuntime({ workflowPath: wfPath, batonPath });
  const rendered = runNext({ workflowDoc: runtime.workflow, batonDoc: runtime.baton, resources: runtime.resources });
  const host = toHostResponse(rendered, {
    runId: 'host-request-run',
    workflow: runtime.workflow,
    workflowPath: wfPath,
    repositoryRoot: root,
    runsRoot: tempDir,
    leaseToken: 'test-lease-token',
  });

  assert.equal(host.requests[0].id, 'review_owner__shard__backend');
  assert.equal(host.requests[0].ownerStepId, 'review_owner');
  assert.equal(host.requests[0].shard.obligation_id, 'review_owner:backend');
  assert.equal(host.requests[0].shard.shard_id, 'backend');
  assert.equal(host.requests[0].shard.reviewer_role, 'backend');
  assert.equal(host.requests[0].shard.privacy_route, 'safe_context');
  assert.equal(Object.hasOwn(host.requests[0], 'leaseToken'), false);
  assert.equal(Object.hasOwn(host.requests[0].shard, 'prompt'), false);
  assert.equal(Object.hasOwn(host.requests[0].shard, 'transcript'), false);
  assert.equal(Object.hasOwn(host.requests[0].shard, 'request_id'), false);
  assert.equal(Object.hasOwn(host.requests[0].shard, 'attempts'), false);
  assert.doesNotThrow(() => assertRunnerHostResponseSchema(host));

  const requestWithToken = structuredClone(host);
  requestWithToken.requests[0].leaseToken = 'forbidden';
  assert.throws(() => assertRunnerHostResponseSchema(requestWithToken), /workflow runner host response failed schema validation/);

  for (const field of ['token', 'prompt', 'transcript', 'session', 'lifecycle', 'storagePath', 'outputPath', 'controlPlane']) {
    const shardWithPrivateField = structuredClone(host);
    shardWithPrivateField.requests[0].shard[field] = 'forbidden';
    assert.throws(() => assertRunnerHostResponseSchema(shardWithPrivateField), /workflow runner host response failed schema validation/);
  }
});

test('sharding: public synthetic request ids can load shard instructions through validation and runner command paths', async () => {
  const wfPath = writeJson('load-instructions-workflow.json', shardedWorkflow());
  const batonPath = writeJson('load-instructions-baton.json', baton());
  const runtime = loadWorkflowRuntime({ workflowPath: wfPath, batonPath });
  const rendered = runNext({ workflowDoc: runtime.workflow, batonDoc: runtime.baton, resources: runtime.resources });
  const host = toHostResponse(rendered, {
    runId: 'load-instructions-host-run',
    workflow: runtime.workflow,
    workflowPath: wfPath,
    repositoryRoot: root,
    runsRoot: tempDir,
    leaseToken: 'test-lease-token',
  });

  const validation = validateLoadInstructions({
    workflowDoc: runtime.workflow,
    batonData: { baton: rendered.baton, requests: host.requests },
    stepId: host.requests[0].stepId,
    resources: runtime.resources,
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.stepId, 'review_owner__shard__backend');

  const runId = 'load-instructions-run';
  const runsRoot = path.join(tempDir, 'runs');
  const leaseToken = 'lease-token-load-instructions';
  const first = await runnerNext({
    runId,
    workflowPath: wfPath,
    runsRoot,
    leaseToken,
  });
  assert.equal(first.requests[0].stepId, 'review_owner__shard__backend');
  const instructions = await runnerLoadInstructions({
    runId,
    workflowPath: wfPath,
    runsRoot,
    stepId: first.requests[0].stepId,
    leaseToken,
  });
  assert.match(instructions, /Shard owner step: review_owner/);
  assert.match(instructions, /Shard obligation id: review_owner:backend/);
  assert.match(instructions, /--step-id 'review_owner__shard__backend'/);
});

test('sharding: complete required coverage joins and records proof under owner step', () => {
  const response = runApply('sharded-complete', {
    steps: {
      review_owner__shard__backend: shardOutput('backend', 'backend'),
      review_owner__shard__security: shardOutput('security', 'security'),
    },
  });

  assert.equal(response.baton.cursor, 'done');
  assert.equal(response.steps[0].action, 'stop_done');
  assert.equal(response.baton.state.review_owner.shard_join_proof.coverage_complete, true);
  assert.deepEqual(response.baton.state.review_owner.shard_join_proof.required_shards, ['backend']);
  assert.deepEqual(response.baton.state.review_owner.shard_join_proof.required_obligation_ids, ['review_owner:backend']);
  assert.deepEqual(response.baton.state.review_owner.shard_join_proof.accepted_obligation_ids, ['review_owner:backend', 'review_owner:security']);
  assert.equal(response.baton.state.review_owner.shard_join_proof.outcome, 'pass');
  assert.deepEqual(response.baton.state.shards.review_owner.join_proof.accepted_shards, ['backend', 'security']);
});

test('sharding: optional missing output still joins when required coverage is complete', () => {
  const response = runApply('sharded-optional-missing', {
    steps: {
      review_owner__shard__backend: shardOutput('backend', 'backend'),
    },
  });

  assert.equal(response.baton.cursor, 'done');
  assert.deepEqual(response.baton.state.shards.review_owner.join_proof.accepted_shards, ['backend']);
  assert.deepEqual(response.baton.state.shards.review_owner.join_proof.optional_shards, ['security']);
});

test('sharding: optional blocked output records blocked shard without failing required coverage', () => {
  const response = runApply('sharded-optional-blocked', {
    steps: {
      review_owner__shard__backend: shardOutput('backend', 'backend'),
      review_owner__shard__security: shardOutput('security', 'security', { outcome: 'blocked' }),
    },
  });

  assert.equal(response.baton.cursor, 'done');
  assert.deepEqual(response.baton.state.shards.review_owner.join_proof.accepted_shards, ['backend']);
  assert.deepEqual(response.baton.state.shards.review_owner.join_proof.blocked_shards, ['security']);
  assert.equal(response.baton.state.shards.review_owner.obligations[1].status, 'blocked');
  assert.equal(response.baton.state.shards.review_owner.obligations[1].attempts, 1);
});

test('sharding: missing required, role mismatch, and retry-exhausted required shard block with durable proof', () => {
  const missing = runApply('sharded-missing-required', {
    steps: {
      review_owner__shard__security: shardOutput('security', 'security'),
    },
  });
  assert.equal(missing.baton.cursor, 'review_owner');
  assert.equal(missing.baton.state.shards.review_owner.status, 'blocked');
  assert.equal(missing.baton.state.shards.review_owner.join_proof.coverage_complete, false);
  assert.deepEqual(missing.baton.state.shards.review_owner.join_proof.blocked_obligation_ids, ['review_owner:backend']);
  assert.equal(missing.baton.recoverableWorkerBlockers.review_owner.source_step_id, 'review_owner');

  const mismatch = runApply('sharded-role-mismatch', {
    steps: {
      review_owner__shard__backend: shardOutput('backend', 'security'),
    },
  });
  assert.equal(mismatch.baton.cursor, 'review_owner');
  assert.equal(mismatch.baton.state.shards.review_owner.status, 'blocked');
  assert.deepEqual(mismatch.baton.state.shards.review_owner.join_proof.blocked_obligation_ids, ['review_owner:backend']);
  assert.match(mismatch.baton.state.shards.review_owner.blocked['review_owner:backend'].reason, /reviewer_role 'security' does not match required role 'backend'/);

  const blocked = runApply('sharded-blocked-required', {
    steps: {
      review_owner__shard__backend: shardOutput('backend', 'backend', { outcome: 'blocked' }),
    },
  });
  assert.equal(blocked.baton.cursor, 'review_owner');
  assert.equal(blocked.baton.state.shards.review_owner.status, 'blocked');
  assert.equal(blocked.baton.state.shards.review_owner.obligations[0].status, 'blocked');
  assert.equal(blocked.baton.state.shards.review_owner.obligations[0].attempts, 1);
  assert.deepEqual(blocked.baton.state.shards.review_owner.join_proof.blocked_obligation_ids, ['review_owner:backend']);
});

test('sharding: retry budget preserves attempts and redispatches pending shard before exhaustion', () => {
  const retryWorkflow = shardedWorkflow();
  retryWorkflow.steps.review_owner.sharding.obligations[0].max_attempts = 2;
  const response = runApply('sharded-retry-pending', {
    steps: {
      review_owner__shard__backend: shardOutput('backend', 'backend', { outcome: 'blocked' }),
    },
  }, retryWorkflow);

  assert.equal(response.baton.cursor, 'review_owner');
  assert.equal(response.baton.state.shards.review_owner.status, 'dispatching');
  assert.equal(response.baton.state.shards.review_owner.obligations[0].status, 'pending');
  assert.equal(response.baton.state.shards.review_owner.obligations[0].attempts, 1);
  assert.equal(response.steps[0].id, 'review_owner__shard__backend');
});

test('sharding: accepted required obligations survive later partial retry completion', () => {
  const retryWorkflow = shardedWorkflow();
  retryWorkflow.steps.review_owner.sharding.obligations[1].required = true;
  retryWorkflow.steps.review_owner.sharding.obligations[1].max_attempts = 2;

  const first = runApply('sharded-partial-retry-first', {
    steps: {
      review_owner__shard__backend: shardOutput('backend', 'backend'),
      review_owner__shard__security: shardOutput('security', 'security', { outcome: 'blocked' }),
    },
  }, retryWorkflow);

  assert.equal(first.baton.cursor, 'review_owner');
  assert.equal(first.baton.state.shards.review_owner.status, 'dispatching');
  assert.equal(first.baton.state.shards.review_owner.obligations[0].status, 'accepted');
  assert.equal(first.baton.state.shards.review_owner.obligations[1].status, 'pending');
  assert.deepEqual(Object.keys(first.baton.state.shards.review_owner.accepted_outputs), ['review_owner:backend']);
  assert.deepEqual(first.steps.map((step) => step.id), ['review_owner__shard__security']);

  const second = runApplyFromBaton('sharded-partial-retry-second', first.baton, {
    steps: {
      review_owner__shard__security: shardOutput('security', 'security'),
    },
  }, retryWorkflow);

  assert.equal(second.baton.cursor, 'done');
  assert.equal(second.steps[0].action, 'stop_done');
  assert.deepEqual(second.baton.state.shards.review_owner.join_proof.accepted_obligation_ids, ['review_owner:backend', 'review_owner:security']);
  assert.deepEqual(second.baton.state.shards.review_owner.join_proof.blocked_obligation_ids, []);
  assert.equal(second.baton.state.shards.review_owner.join_proof.coverage_complete, true);
});

test('sharding: workflow validation rejects duplicate ids, unsafe ids, unknown roles, unsafe privacy, non-worker policies, and missing output identity contract', () => {
  const duplicate = shardedWorkflow();
  duplicate.steps.review_owner.sharding.obligations[1].shard_id = 'backend';
  assert.match(runInspect('sharded-duplicate', duplicate, false).stderr, /duplicate shard id 'backend'/);

  const unsafeId = shardedWorkflow();
  unsafeId.steps.review_owner.sharding.obligations[0].shard_id = 'bad/name';
  assert.match(runInspect('sharded-unsafe-id', unsafeId, false).stderr, /workflow failed schema validation|shard_id/);

  const dottedId = shardedWorkflow();
  dottedId.steps.review_owner.sharding.obligations[0].shard_id = 'api.v1';
  assert.match(runInspect('sharded-dotted-id', dottedId, false).stderr, /workflow failed schema validation|shard_id/);

  const parallelSharded = shardedWorkflow({
    start: 'prepare',
    steps: {
      prepare: {
        name: 'Prepare',
        kind: 'worker',
        input: { prompt: 'Prepare parallel reviews.' },
        output: outputContract(),
        next: ['review_owner', 'other_review'],
      },
      review_owner: {
        ...shardedWorkflow().steps.review_owner,
        next: 'join',
      },
      other_review: {
        name: 'Other review',
        kind: 'worker',
        input: { prompt: 'Other review.' },
        output: outputContract(),
        next: 'join',
      },
      join: {
        name: 'Join',
        kind: 'worker',
        input: { prompt: 'Join reviews.' },
        output: outputContract(),
        next: 'done',
      },
    },
  });
  assert.match(runInspect('sharded-parallel-target', parallelSharded, false).stderr, /cannot fan out to sharded step 'review_owner'/);

  const unknownRole = shardedWorkflow();
  unknownRole.steps.review_owner.sharding.obligations[0].reviewer_role = 'missing-role';
  assert.match(runInspect('sharded-unknown-role', unknownRole, false).stderr, /reviewer_role 'missing-role' is not an allowed role/);

  const unsafePrivacy = shardedWorkflow();
  unsafePrivacy.steps.review_owner.sharding.obligations[0].privacy_route = 'private_prompt';
  assert.match(runInspect('sharded-unsafe-privacy', unsafePrivacy, false).stderr, /workflow failed schema validation|privacy_route/);

  const nonWorker = shardedWorkflow();
  nonWorker.steps.done.sharding = {
    enabled: true,
    mode: 'review_shards',
    obligations: [{ shard_id: 'done-review', reviewer_role: 'backend' }],
  };
  assert.match(runInspect('sharded-non-worker', nonWorker, false).stderr, /workflow failed schema validation|sharding is only supported on worker steps/);

  writeFileSync(path.join(tempDir, 'bad-sharded-output.schema.json'), `${JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: { outcome: { enum: ['ready'] } },
    additionalProperties: false,
  }, null, 2)}\n`);
  const missingIdentity = shardedWorkflow();
  missingIdentity.steps.review_owner.output.schema = 'bad-sharded-output.schema.json';
  assert.match(runInspect('sharded-missing-output-identity', missingIdentity, false).stderr, /requires output.schema to require string field 'shard_id'/);
});
