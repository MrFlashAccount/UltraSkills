import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, test } from 'bun:test';
import { continueRun, loadInstructions, next, writeOutput } from './helpers/orbita-production-api.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const tempDir = mkdtempSync(path.join(tmpdir(), 'build-it-workflow-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

async function start(label) {
  const context = {
    runId: `build-it-contract-${label}-${process.pid}`,
    workflowPath: path.join(root, 'workflows/build-it/workflow.toml'),
    runsRoot: path.join(tempDir, label),
    leaseToken: `build-it-test-lease-${label}-${process.pid}`,
  };
  const response = await next({ ...context, userPrompt: 'Add a bounded backend feature to this repository. No prior research or plan exists.' });
  assert.deepEqual(response.requests.map((request) => request.stepId), ['architecture_draft']);
  return context;
}

async function submit(context, stepId, output) {
  const { runDir } = resolveRunPaths(context);
  const debugSummaryFile = stepId === 'approve_architecture' ? undefined : path.join(runDir, stepId, 'debug-summary.md');
  if (debugSummaryFile !== undefined) {
    mkdirSync(path.dirname(debugSummaryFile), { recursive: true });
    writeFileSync(debugSummaryFile, 'Build It route contract fixture.\n');
  }
  await writeOutput({ ...context, stepId, json: JSON.stringify(output), debugSummaryFile });
  return continueRun(context);
}

function draft(context, outcome, revision) {
  const { runDir } = resolveRunPaths(context);
  const artifactPath = path.join(runDir, 'architecture_draft', 'artifacts', `canvas-${revision}.md`);
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  // This fixture proves navigation and approval authority, not model-generated Canvas quality.
  writeFileSync(artifactPath, '# Bounded backend feature\n');
  return {
    outcome,
    summary: 'One backend zone, bounded behavior and explicit rollback.',
    task_context: {
      goal: 'Add the bounded backend feature.',
      non_goals: ['Frontend changes'],
      acceptance_criteria: ['The behavior is observable and verified.'],
      repo: 'test-repository',
      issue_url: '',
    },
    implementer_owners: { backend: ['src/backend'] },
    selected_implementation_steps: ['backend_implementation'],
    reviewer_plan: { backend: ['Inspect the changed behavior and rollback.'] },
    artifacts: [{ id: 'reasons-canvas-architecture', content_type: 'text/markdown', path: artifactPath }],
  };
}

function verdict(outcome) {
  return {
    outcome,
    verdict: {
      summary: [outcome === 'approved' ? 'No actionable finding remains.' : 'Clarify rollback before approval.'],
      evidence_checked: ['The current architecture Canvas'],
      findings: outcome === 'approved' ? [] : [{ severity: 'must_fix', summary: 'Missing rollback condition' }],
    },
  };
}

test('Build It accepts a raw task and requires design challenge and current user approval before implementation', async () => {
  const context = await start('approval');
  const attack = await submit(context, 'architecture_draft', draft(context, 'ready_for_attack', 1));
  assert.deepEqual(attack.requests.map((request) => request.stepId), ['architecture_attack']);
  const revision = await submit(context, 'architecture_attack', verdict('needs_revision'));
  assert.deepEqual(revision.requests.map((request) => request.stepId), ['architecture_draft']);
  await submit(context, 'architecture_draft', draft(context, 'ready_for_attack', 2));
  const approval = await submit(context, 'architecture_attack', verdict('approved'));
  assert.equal(approval.requests[0].action, 'wait_for_approval');
  assert.equal(approval.requests[0].stepId, 'approve_architecture');
  await assert.rejects(() => loadInstructions({ ...context, stepId: 'backend_implementation' }));

  const rejected = await submit(context, 'approve_architecture', { approval: 'rejected', feedback: 'Make the scope smaller.' });
  assert.deepEqual(rejected.requests.map((request) => request.stepId), ['architecture_draft']);
  const corrected = await submit(context, 'architecture_draft', draft(context, 'ready_for_approval', 3));
  assert.equal(corrected.requests[0].action, 'wait_for_approval');
  assert.equal(corrected.requests[0].stepId, 'approve_architecture');
  const instructions = await loadInstructions({ ...context, stepId: 'approve_architecture' });
  assert.doesNotMatch(instructions, /Missing rollback condition/);

  const implementation = await submit(context, 'approve_architecture', { approval: 'approved' });
  assert.equal(implementation.requests.length, 1);
  const branchInstructions = await loadInstructions({ ...context, stepId: implementation.requests[0].stepId });
  assert.match(branchInstructions, /Implement only backend-owned zones/);

  const owner = await submit(context, implementation.requests[0].stepId, {
    outcome: 'implemented',
    implementer_owner: 'backend',
    summary: 'Fixture implementation is verified.',
    change_summary: ['The declared fixture behavior is present.'],
    changed_files: ['src/backend/feature.mjs'],
    verification_results: [{ check: 'Fixture behavior check', result: 'passed', evidence: 'Fixture-only result' }],
    role_material: { role: 'backend', loaded: ['roles/backend/ROLE.md', 'roles/backend/RUBRIC.md'], requirements_satisfied: true },
    warnings: [],
  });
  assert.deepEqual(owner.requests.map((request) => request.stepId), ['implementation']);
  const done = await submit(context, 'implementation', {
    outcome: 'ready_for_review',
    summary: 'Verified fixture awaits independent code review.',
    repo: 'test-repository',
    issue_url: '',
    status: 'ready_for_review',
    implementer_owners: { backend: ['src/backend'] },
    execution_contract_basis: 'Current approved architecture Canvas',
    branch_name: '',
    pr_url: '',
    change_summary: ['The declared fixture behavior is present.'],
    verification_results: [{ implementer_owner: 'backend', check: 'Fixture behavior check', result: 'passed', evidence: 'Fixture-only result', role_material_requirements_satisfied: true }],
    review_handoff: {
      prior: 'hostile_prior',
      review_status: 'not_run',
      reviewer_plan: { backend: ['Inspect the changed behavior and rollback.'] },
      hotspots: ['src/backend/feature.mjs'],
      contract_gaps: [],
      resolved_proof_obligations: [],
      architecture_contract_deviations: [],
      unresolved_compatibility_surfaces: [],
      negative_checks_run: [],
    },
    warnings: [],
    next_action: 'Run separate independent code review.',
    issue_comment: '',
  });
  assert.equal(done.status, 'done');
  assert.equal(done.baton.state.implementation.status, 'ready_for_review');
  assert.equal(done.baton.state.implementation.review_handoff.review_status, 'not_run');
});

test('Build It rejects a selected implementation branch without its matching owner zone', async () => {
  const context = await start('owner');
  const output = draft(context, 'ready_for_attack', 1);
  output.selected_implementation_steps = ['frontend_implementation'];
  await assert.rejects(() => submit(context, 'architecture_draft', output));
});

test('Build It preserves an Architect-owned document slice without assigning it to a code worker', async () => {
  const context = await start('architecture-docs');
  const output = draft(context, 'ready_for_attack', 1);
  output.task_context.goal = 'Update the declared durable architecture contract.';
  output.implementer_owners = { architect: ['src/feature/CONTEXT.md'] };
  output.selected_implementation_steps = ['architecture_artifact_update'];
  output.reviewer_plan = { architect: ['Check the durable boundary contract.'] };
  await submit(context, 'architecture_draft', output);
  await submit(context, 'architecture_attack', verdict('approved'));
  const implementation = await submit(context, 'approve_architecture', { approval: 'approved' });
  assert.equal(implementation.requests.length, 1);
  const instructions = await loadInstructions({ ...context, stepId: implementation.requests[0].stepId });
  assert.match(instructions, /Implement only the approved architecture-document zones/);
  assert.match(instructions, /implementer_owner architect/);
});

test('Build It attack limit retains unresolved findings at the user gate without starting implementation', async () => {
  const context = await start('limit');
  for (const revision of [1, 2]) {
    await submit(context, 'architecture_draft', draft(context, 'ready_for_attack', revision));
    const response = await submit(context, 'architecture_attack', verdict('needs_revision'));
    if (revision === 1) {
      assert.deepEqual(response.requests.map((request) => request.stepId), ['architecture_draft']);
    } else {
      assert.equal(response.requests[0].action, 'wait_for_approval');
      assert.equal(response.requests[0].stepId, 'approve_architecture');
      assert.match(response.orchestratorInstruction, /Missing rollback condition/);
    }
  }
});
