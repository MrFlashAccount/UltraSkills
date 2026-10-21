import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import {
  continueRun,
  listPointerTransitions,
  loadInstructions,
  movePointer,
  next,
  writeOutput,
} from './helpers/orbita-production-api.mjs';
import { registerWorkflowRunAtRoot } from '../persistence/run-state/workflow-runs.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';

const testRoot = mkdtempSync(path.join(tmpdir(), 'workflow-runner-pointer-fanout-'));
const runsRoot = path.join(testRoot, 'runs');
const workflowPath = path.join(testRoot, 'workflow.json');

afterAll(() => rmSync(testRoot, { recursive: true, force: true }));

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function outputContract(schema) {
  return { template: 'output.md', schema };
}

const reviewBranchIds = [
  'architect_review',
  'backend_review',
  'frontend_review',
  'frontend_taste_review',
  'security_review',
];

function workflowDocument({ ownerPrompt }) {
  const reviewBranchPrompt = ownerPrompt === 'compatibility'
    ? 'Current review branches: ${{ input.implementation.review_branches | default: "Use the accepted current fanout branches." }}'
    : ownerPrompt === 'unrecoverable'
      ? 'Current reviewer handoffs: ${{ input.implementation.reviewer_handoffs }}'
      : 'Current review branches: ${{ input.implementation.review_branches }}';
  const reviewerEvidencePrompt = reviewBranchIds
    .map((branchId) => `${branchId}: \${{ input.${branchId} }}`)
    .join('\n');
  const reviewBranches = Object.fromEntries(reviewBranchIds.map((branchId) => [branchId, {
    name: branchId,
    input: { prompt: `Run ${branchId}.` },
    output: outputContract('branch.schema.json'),
  }]));
  return {
    name: 'pointer-fanout-regression',
    version: 1,
    start: 'plan',
    done: 'done',
    steps: {
      plan: {
        name: 'Plan',
        kind: 'worker',
        input: { prompt: 'Select review branches.' },
        output: outputContract('plan.schema.json'),
        next: 'implementation',
      },
      implementation: {
        name: 'Implementation',
        kind: 'fanout',
        input: {
          branches: ['backend_implementation'],
          prompt: 'Aggregate accepted implementation output.',
        },
        output: outputContract('implementation.schema.json'),
        branches: {
          backend_implementation: {
            name: 'Backend implementation',
            input: { prompt: 'Implement the backend slice.' },
            output: outputContract('branch.schema.json'),
          },
        },
        next: {
          match: '${{ output.outcome }}',
          cases: {
            ready_for_review: 'review',
            ready_for_user_approval: 'approve_implementation',
          },
        },
      },
      review: {
        name: 'Review',
        kind: 'fanout',
        max_parallel: 5,
        input: {
          branches: {
            first_of: [
              '${{ input.implementation.review_branches }}',
              '${{ input.plan.review_branches }}',
            ],
          },
          prompt: `${reviewBranchPrompt}\n${reviewerEvidencePrompt}`,
        },
        output: outputContract('review.schema.json'),
        branches: reviewBranches,
        next: 'approve_implementation',
      },
      approve_implementation: {
        name: 'Approve implementation',
        kind: 'approval',
        input: {
          summary: '${{ input.implementation.summary }}',
        },
        next: {
          match: '${{ output.approval }}',
          cases: {
            approved: 'done',
            rejected: 'implementation',
          },
        },
      },
      done: { name: 'Done', kind: 'done' },
    },
  };
}

function writeWorkflow(options) {
  writeJson(workflowPath, workflowDocument(options));
}

function writeImplementationSchema({ requireReviewInput }) {
  writeJson(path.join(testRoot, 'implementation.schema.json'), {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'summary'],
    properties: {
      outcome: { enum: ['ready_for_review', 'ready_for_user_approval'] },
      summary: { type: 'string' },
      review_branches: { type: 'array', items: { enum: reviewBranchIds }, minItems: 1, uniqueItems: true },
      reviewer_handoffs: { type: 'object' },
    },
    ...(requireReviewInput ? {
      allOf: [{
        if: {
          properties: { outcome: { const: 'ready_for_user_approval' } },
          required: ['outcome'],
        },
        then: { required: ['review_branches', 'reviewer_handoffs'] },
      }],
    } : {}),
    additionalProperties: false,
  });
}

function debugSummaryFile(paths, stepId) {
  const filePath = path.join(paths.runDir, stepId, 'debug-summary.md');
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `debug summary for ${stepId}\n`);
  return filePath;
}

async function acceptWorker(run, stepId, output) {
  return writeOutput({
    ...run,
    stepId,
    json: JSON.stringify(output),
    debugSummaryFile: debugSummaryFile(run.paths, stepId),
  });
}

async function acceptApproval(run, approval, feedback) {
  return writeOutput({
    ...run,
    stepId: 'approve_implementation',
    json: JSON.stringify({ approval, ...(feedback ? { feedback } : {}) }),
  });
}

function batonSnapshot(paths) {
  return JSON.parse(readFileSync(paths.batonPath, 'utf8'));
}

function durableControlSnapshot(paths) {
  return {
    baton: readFileSync(paths.batonPath, 'utf8'),
    history: readFileSync(paths.historyPath, 'utf8'),
    authority: readFileSync(paths.authorityPath, 'utf8'),
    currentRequests: readFileSync(paths.currentRequestsPath, 'utf8'),
    runIndex: readFileSync(paths.runsIndexPath, 'utf8'),
  };
}

function branchOutput(summary) {
  return { outcome: 'ready', summary };
}

function recoveredReviewOutput(branchId) {
  if (branchId === 'backend_review') {
    return {
      outcome: 'ready',
      summary: 'backend needs changes',
      verdict: 'needs_changes',
      findings: [
        'TaskJournal still owns prompt reservation outside sole turn_delivery ownership.',
        'A duplicate provider child thread id can overwrite an existing task.',
        'Several backend modules violate the size and cohesion gate.',
      ],
    };
  }
  if (branchId === 'security_review') {
    return {
      outcome: 'ready',
      summary: 'security needs changes',
      verdict: 'needs_changes',
      findings: [
        'Legacy codewide_spawn_agent bypasses shared-write policy through LegacyShared, an inherited writable profile, and selectable cwd.',
      ],
    };
  }
  return {
    outcome: 'ready',
    summary: `${branchId} passed`,
    verdict: 'pass',
    findings: [],
  };
}

test('user rework returns to approval while pointer recovery preserves one accepted review activation and its findings', async () => {
  writeFileSync(path.join(testRoot, 'output.md'), '## Output\nReturn JSON.\n');
  writeJson(path.join(testRoot, 'branch.schema.json'), {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'summary'],
    properties: {
      outcome: { const: 'ready' },
      summary: { type: 'string' },
      verdict: { enum: ['pass', 'needs_changes'] },
      findings: { type: 'array', items: { type: 'string', minLength: 1 } },
    },
    additionalProperties: false,
  });
  writeJson(path.join(testRoot, 'plan.schema.json'), {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'review_branches'],
    properties: {
      outcome: { const: 'ready' },
      review_branches: { type: 'array', items: { enum: reviewBranchIds }, minItems: 1, uniqueItems: true },
    },
    additionalProperties: false,
  });
  writeImplementationSchema({ requireReviewInput: false });
  writeJson(path.join(testRoot, 'review.schema.json'), {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: { outcome: { const: 'approved' } },
    additionalProperties: false,
  });
  writeWorkflow({ ownerPrompt: 'review-branches' });

  const runId = `pointer-fanout-regression-${process.pid}`;
  const registration = await registerWorkflowRunAtRoot({
    runId,
    workflowPath,
    runsRoot,
    claim: true,
    owner: 'pointer-fanout-test',
    harness: 'bun-test',
    sessionId: 'pointer-fanout-session',
  });
  const paths = resolveRunPaths({ runId, workflowPath, runsRoot });
  const run = { runId, workflowPath, runsRoot, paths, leaseToken: registration.leaseToken };

  let response = await next(run);
  assert.deepEqual(response.requests.map((request) => request.stepId), ['plan']);
  await acceptWorker(run, 'plan', { outcome: 'ready', review_branches: reviewBranchIds });
  response = await continueRun(run);
  assert.deepEqual(response.requests.map((request) => request.fanout.branch_id), ['backend_implementation']);

  await acceptWorker(run, response.requests[0].stepId, branchOutput('initial implementation'));
  response = await continueRun(run);
  assert.deepEqual(response.requests.map((request) => request.stepId), ['implementation']);
  await acceptWorker(run, 'implementation', {
    outcome: 'ready_for_review',
    summary: 'initial implementation ready',
    review_branches: reviewBranchIds,
    reviewer_handoffs: Object.fromEntries(reviewBranchIds.map((branchId) => [branchId, { summary: branchId }])),
  });
  response = await continueRun(run);
  assert.deepEqual(response.requests.map((request) => request.fanout.branch_id), reviewBranchIds);

  for (const request of response.requests) {
    await acceptWorker(run, request.stepId, branchOutput(`initial ${request.fanout.branch_id}`));
  }
  response = await continueRun(run);
  assert.deepEqual(response.requests.map((request) => request.stepId), ['review']);
  await acceptWorker(run, 'review', { outcome: 'approved' });
  response = await continueRun(run);
  assert.deepEqual(response.requests.map((request) => request.stepId), ['approve_implementation']);
  assert.equal(response.baton.state.fanouts.review.activation, 1);

  await acceptApproval(run, 'rejected', 'Apply requested rework.');
  response = await continueRun(run);
  assert.equal(response.baton.state.fanouts.implementation.activation, 2);
  await acceptWorker(run, response.requests[0].stepId, branchOutput('reworked implementation'));
  response = await continueRun(run);
  await acceptWorker(run, 'implementation', {
    outcome: 'ready_for_user_approval',
    summary: 'rework ready for approval',
  });
  response = await continueRun(run);
  assert.deepEqual(response.requests.map((request) => request.stepId), ['approve_implementation']);

  const pointerOptions = await listPointerTransitions(run);
  const reviewTransition = pointerOptions.transitions.find((transition) => transition.to.cursor === 'review');
  assert.ok(reviewTransition);
  const beforeRejectedMove = durableControlSnapshot(paths);

  writeImplementationSchema({ requireReviewInput: true });
  await assert.rejects(
    () => movePointer({
      ...run,
      transitionId: reviewTransition.id,
      feedback: 'Run a fresh mandatory review.',
    }),
    /pointer move preflight failed for target 'review': persisted input 'implementation' does not satisfy the current output contract/,
  );
  assert.deepEqual(durableControlSnapshot(paths), beforeRejectedMove);

  writeImplementationSchema({ requireReviewInput: false });
  await assert.rejects(
    () => movePointer({
      ...run,
      transitionId: reviewTransition.id,
      feedback: 'Run a fresh mandatory review.',
    }),
    /pointer move preflight failed for target 'review'.*input\.implementation\.review_branches/,
  );
  assert.deepEqual(durableControlSnapshot(paths), beforeRejectedMove);

  writeWorkflow({ ownerPrompt: 'compatibility' });
  const moved = await movePointer({
    ...run,
    transitionId: reviewTransition.id,
    feedback: 'Run a fresh mandatory review.',
  });
  assert.equal(moved.current.cursor, 'review');
  response = await next(run);
  assert.equal(response.baton.state.fanouts.review.activation, 2);
  assert.deepEqual(response.requests.map((request) => request.fanout.branch_id), reviewBranchIds);

  for (const request of response.requests) {
    await acceptWorker(run, request.stepId, recoveredReviewOutput(request.fanout.branch_id));
  }
  const acceptedBaton = batonSnapshot(paths);
  assert.equal(acceptedBaton.state.fanouts.review.activation, 2);
  assert.ok(acceptedBaton.pointerTransitions[reviewTransition.id]);
  const acceptedByBranch = Object.fromEntries(response.requests.map((request) => [
    request.fanout.branch_id,
    acceptedBaton.state[request.stepId],
  ]));
  assert.deepEqual(acceptedByBranch.backend_review.findings, [
    'TaskJournal still owns prompt reservation outside sole turn_delivery ownership.',
    'A duplicate provider child thread id can overwrite an existing task.',
    'Several backend modules violate the size and cohesion gate.',
  ]);
  assert.deepEqual(acceptedByBranch.security_review.findings, [
    'Legacy codewide_spawn_agent bypasses shared-write policy through LegacyShared, an inherited writable profile, and selectable cwd.',
  ]);
  const acceptedRequestIds = acceptedBaton.state.fanouts.review.branch_records.map((record) => record.request_id);

  writeWorkflow({ ownerPrompt: 'unrecoverable' });
  await assert.rejects(
    () => continueRun({
      ...run,
      bindAgents: response.requests.map((request) => `${request.stepId}=agent-${request.fanout.branch_id}`),
    }),
    /workflow prompt render failed: prompt expression.*input\.implementation\.reviewer_handoffs/,
  );
  const failedBaton = batonSnapshot(paths);
  assert.deepEqual(failedBaton, acceptedBaton);

  const recoveries = await listPointerTransitions(run);
  const activeRecovery = recoveries.transitions.find((transition) => transition.id === reviewTransition.id);
  assert.equal(activeRecovery?.direction, 'resume');
  assert.equal(activeRecovery?.to.cursor, 'review');

  writeWorkflow({ ownerPrompt: 'review-branches' });
  const resumed = await movePointer({
    ...run,
    transitionId: activeRecovery.id,
    feedback: 'Resume the accepted review activation without repeating its five branches.',
  });
  assert.deepEqual(resumed.warnings, [`overwrote active pointer transition '${activeRecovery.id}'`]);
  const resumedBaton = batonSnapshot(paths);
  assert.equal(resumedBaton.state.fanouts.review.activation, 2);
  assert.equal(resumedBaton.state.fanouts.review.phase, 'owner');
  assert.deepEqual(
    resumedBaton.state.fanouts.review.branch_records.map((record) => record.request_id),
    acceptedRequestIds,
  );
  assert.equal(Object.hasOwn(resumedBaton.state.implementation, 'review_branches'), false);
  for (const branchId of reviewBranchIds) {
    assert.deepEqual(resumedBaton.state[branchId], acceptedByBranch[branchId]);
  }

  response = await next(run);
  assert.deepEqual(response.requests.map((request) => request.stepId), ['review']);
  assert.equal(response.baton.state.fanouts.review.activation, 2);
  assert.equal(response.baton.state.fanouts.review.phase, 'owner');
  assert.deepEqual(
    response.baton.state.fanouts.review.branch_records.map((record) => record.request_id),
    acceptedRequestIds,
  );
  assert.equal(Object.hasOwn(response.baton.state.implementation, 'review_branches'), false);
  for (const branchId of reviewBranchIds) {
    assert.deepEqual(response.baton.state[branchId], acceptedByBranch[branchId]);
  }
  const ownerInstructions = await loadInstructions({ ...run, stepId: 'review' });
  assert.match(ownerInstructions, /TaskJournal still owns prompt reservation outside sole turn_delivery ownership/);
  assert.match(ownerInstructions, /duplicate provider child thread id can overwrite an existing task/);
  assert.match(ownerInstructions, /backend modules violate the size and cohesion gate/);
  assert.match(ownerInstructions, /codewide_spawn_agent bypasses shared-write policy through LegacyShared/);
  assert.ok(response.baton.pointerTransitions[reviewTransition.id]);
});
