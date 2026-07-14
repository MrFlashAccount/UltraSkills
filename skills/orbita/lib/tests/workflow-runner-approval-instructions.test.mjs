import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import {
  continueRun,
  loadInstructions,
  next,
  reportStop,
  resolveStop,
  writeOutput,
} from './helpers/orbita-production-api.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-runner-approval-instructions-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function approvalWorkflow(label) {
  const workflowDir = path.join(tempDir, label);
  const workflowPath = path.join(workflowDir, 'workflow.json');
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(path.join(workflowDir, 'output.md'), 'Return the typed producer output.\n');
  writeJson(path.join(workflowDir, 'producer.schema.json'), {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'summary', 'artifacts'],
    properties: {
      outcome: { const: 'ready' },
      summary: { type: 'string', minLength: 1 },
      artifacts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'content_type', 'path'],
          properties: {
            id: { type: 'string' },
            content_type: { type: 'string' },
            path: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  });
  writeJson(workflowPath, {
    name: 'approval-instructions-check',
    version: 1,
    start: 'prepare',
    done: 'done',
    steps: {
      prepare: {
        name: 'Prepare approval',
        kind: 'worker',
        input: { prompt: 'Prepare the approval packet.' },
        output: { template: 'output.md', schema: 'producer.schema.json' },
        next: 'approve',
      },
      approve: {
        name: 'Approve packet',
        kind: 'approval',
        input: {
          summary: '${{ input.prepare.summary }}',
          artifacts: ['${{ input.prepare.artifacts }}'],
        },
        next: { match: '${{ output.approval }}', cases: { approved: 'done', rejected: 'done' } },
      },
      done: { name: 'Done', kind: 'done' },
    },
  });
  return workflowPath;
}

function debugSummary(runDir) {
  const filePath = path.join(runDir, 'prepare', 'debug-summary.md');
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, 'approval fixture prepared\n');
  return filePath;
}

async function prepareApproval(label) {
  const workflowPath = approvalWorkflow(label);
  const runId = `workflow-runner-test-${process.pid}-${label}`;
  const runsRoot = path.join(tempDir, `${label}-runs`);
  const leaseToken = `${label}-lease-${process.pid}`;
  const paths = resolveRunPaths({ runId, workflowPath, runsRoot });
  await next({ runId, workflowPath, runsRoot, leaseToken });
  const artifactPath = path.join(paths.runDir, 'prepare', 'artifacts', 'packet.md');
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, '# Approval packet\n');
  await writeOutput({
    runId,
    workflowPath,
    runsRoot,
    stepId: 'prepare',
    json: JSON.stringify({
      outcome: 'ready',
      summary: 'The packet is ready for a current human decision.',
      artifacts: [{ id: 'packet', content_type: 'text/markdown', path: artifactPath }],
    }),
    debugSummaryFile: debugSummary(paths.runDir),
    leaseToken,
  });
  return { runId, workflowPath, runsRoot, leaseToken, paths, artifactPath };
}

test('approval instructions use the public approval projection and reject stop-superseded and terminal commands', async () => {
  const context = await prepareApproval('public-dispatch');
  const approval = await continueRun(context);
  assert.equal(approval.requests[0].action, 'wait_for_approval');

  const instructions = await loadInstructions({ ...context, stepId: 'approve' });
  const followUp = await loadInstructions({ ...context, stepId: 'approve', followUp: true });
  assert.equal(followUp, instructions);
  assert.ok(approval.orchestratorInstruction.includes(instructions));
  assert.match(instructions, /The packet is ready for a current human decision/);
  assert.match(instructions, /\{ "approval": "approved" \}/);
  assert.doesNotMatch(instructions, /## Required reads|## Workflow step prompt|follow-up omits the full template/);

  await reportStop({
    ...context,
    stepId: 'approve',
    json: JSON.stringify({
      non_blocking_stop: {
        stop_id: '00000000-0000-4000-8000-000000000101',
        summary: 'Approval needs one bounded clarification.',
        needed: 'Resolve the current approval concern.',
        source_step_id: 'approve',
      },
    }),
  });
  await assert.rejects(
    () => loadInstructions({ ...context, stepId: 'approve' }),
    /stale workflow-runner command from an older response/,
  );
  const recovery = await continueRun(context);
  assert.equal(recovery.requests[0].action, 'resolve_non_blocking_stop');
  await resolveStop({
    ...context,
    stepId: 'approve',
    json: JSON.stringify({
      stop_id: '00000000-0000-4000-8000-000000000101',
      resolution: { summary: 'Concern resolved.', decision: 'Resume the same approval.' },
    }),
  });
  await continueRun(context);
  await writeOutput({ ...context, stepId: 'approve', json: JSON.stringify({ approval: 'approved' }) });
  const done = await continueRun(context);
  assert.equal(done.status, 'done');
  await assert.rejects(
    () => loadInstructions({ ...context, stepId: 'approve' }),
    /stale workflow-runner command from an older response/,
  );
});

for (const mutation of ['missing', 'symlink-swapped']) {
  test(`approval projection rejects ${mutation} attachment before durable transition`, async () => {
    const context = await prepareApproval(`attachment-${mutation}`);
    const batonBefore = readFileSync(context.paths.batonPath, 'utf8');
    const requestsBefore = readFileSync(context.paths.currentRequestsPath, 'utf8');
    rmSync(context.artifactPath, { force: true });
    if (mutation === 'symlink-swapped') {
      const outsidePath = path.join(tempDir, `outside-${mutation}.md`);
      writeFileSync(outsidePath, 'private outside body must not be read\n');
      symlinkSync(outsidePath, context.artifactPath, 'file');
    }

    await assert.rejects(
      () => continueRun(context),
      mutation === 'missing' ? /missing artifact file/ : /escape run directory via symlink/,
    );
    assert.equal(readFileSync(context.paths.batonPath, 'utf8'), batonBefore);
    assert.equal(readFileSync(context.paths.currentRequestsPath, 'utf8'), requestsBefore);
  });
}

test('next preflights worker rendering before replacing durable current requests', async () => {
  const workflowDir = path.join(tempDir, 'worker-render-atomicity');
  const workflowPath = path.join(workflowDir, 'workflow.json');
  const inputTemplate = path.join(workflowDir, 'input.md');
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(inputTemplate, 'Render this worker input.\n');
  writeFileSync(path.join(workflowDir, 'output.md'), 'Return markdown.\n');
  writeJson(workflowPath, {
    name: 'worker-render-atomicity',
    version: 1,
    start: 'prepare',
    done: 'done',
    steps: {
      prepare: {
        name: 'Prepare',
        kind: 'worker',
        input: { template: 'input.md', prompt: 'Prepare.' },
        output: { template: 'output.md' },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  });
  const runId = `workflow-runner-test-${process.pid}-worker-render-atomicity`;
  const runsRoot = path.join(tempDir, 'worker-render-atomicity-runs');
  const leaseToken = `worker-render-atomicity-${process.pid}`;
  const paths = resolveRunPaths({ runId, workflowPath, runsRoot });
  await next({ runId, workflowPath, runsRoot, leaseToken });
  const batonBefore = readFileSync(paths.batonPath, 'utf8');
  const requestsBefore = readFileSync(paths.currentRequestsPath, 'utf8');
  rmSync(inputTemplate);

  await assert.rejects(
    () => next({ runId, workflowPath, runsRoot, leaseToken }),
    /missing input template/,
  );
  assert.equal(readFileSync(paths.batonPath, 'utf8'), batonBefore);
  assert.equal(readFileSync(paths.currentRequestsPath, 'utf8'), requestsBefore);

  const initialRunId = `workflow-runner-test-${process.pid}-worker-render-initial-failure`;
  const initialPaths = resolveRunPaths({ runId: initialRunId, workflowPath, runsRoot });
  await assert.rejects(
    () => next({ runId: initialRunId, workflowPath, runsRoot, leaseToken: `${leaseToken}-initial` }),
    /missing input template/,
  );
  assert.equal(existsSync(initialPaths.batonPath), false);
  assert.equal(existsSync(initialPaths.historyPath), false);
  assert.equal(existsSync(initialPaths.currentRequestsPath), false);
});

test('next preserves first-commit recovery authority across every journal application stage', async () => {
  for (const failurePoint of ['pending', 'history', 'baton', 'currentRequests']) {
    const workflowPath = approvalWorkflow(`initial-durable-${failurePoint}`);
    const runId = `workflow-runner-test-${process.pid}-initial-durable-${failurePoint}`;
    const runsRoot = path.join(tempDir, `initial-durable-${failurePoint}-runs`);
    const leaseToken = `initial-durable-${failurePoint}-${process.pid}`;
    const paths = resolveRunPaths({ runId, workflowPath, runsRoot });

    process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER = failurePoint;
    try {
      await assert.rejects(
        () => next({ runId, workflowPath, runsRoot, leaseToken }),
        new RegExp(`injected durable commit failure after ${failurePoint}`),
      );
    } finally {
      delete process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER;
    }

    assert.equal(existsSync(paths.batonPath), false);
    assert.equal(existsSync(paths.historyPath), false);
    assert.equal(existsSync(paths.currentRequestsPath), false);
    assert.equal(existsSync(paths.durableCommitPath), true);
    const pendingCommit = readFileSync(paths.durableCommitPath, 'utf8');
    assert.doesNotMatch(pendingCommit, new RegExp(leaseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const authority = JSON.parse(readFileSync(paths.authorityPath, 'utf8'));
    assert.equal(authority.status, 'running');
    assert.equal(typeof authority.workerLease?.tokenHash, 'string');

    const recovered = await next({ runId, workflowPath, runsRoot, leaseToken });
    assert.equal(recovered.status, 'needs_host_actions');
    assert.deepEqual(recovered.requests.map((request) => request.stepId), ['prepare']);
    assert.equal(existsSync(paths.durableCommitPath), false);
    assert.equal(existsSync(paths.batonPath), true);
    assert.equal(existsSync(paths.historyPath), true);
    assert.equal(existsSync(paths.currentRequestsPath), true);
    const persistedRequests = readFileSync(paths.currentRequestsPath, 'utf8');
    const persistedHistory = readFileSync(paths.historyPath, 'utf8');
    assert.doesNotMatch(`${persistedRequests}\n${persistedHistory}`, new RegExp(leaseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(JSON.stringify(recovered), new RegExp(leaseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
