import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, test } from 'bun:test';
import {
  continueRun,
  loadInstructions,
  next,
  registerWorkflowRun,
  writeOutput,
} from './helpers/orbita-production-api.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const configuredEvidenceRoot = process.env.DIALECTIC_EVIDENCE_ROOT?.trim();
const runsRoot = configuredEvidenceRoot || mkdtempSync(path.join(tmpdir(), 'dialectic-public-run-evidence-'));
const preserveEvidence = configuredEvidenceRoot !== undefined && configuredEvidenceRoot.length > 0;
mkdirSync(runsRoot, { recursive: true });

afterAll(() => {
  if (!preserveEvidence) rmSync(runsRoot, { recursive: true, force: true });
});

function architectureFingerprint(label = 'decision') {
  return {
    boundaries: label,
    ownership: label,
    dependency_direction: label,
    runtime_data_flow: label,
    assumptions: label,
    evidence_interpretation: label,
    compatibility: label,
    rejected_alternatives: label,
  };
}

function diagnosticFingerprint(label = 'model') {
  return {
    causal_model: label,
    recommendation: label,
    assumptions: label,
    evidence_interpretation: label,
    baseline: label,
    counterexamples: label,
  };
}

function requestByBranch(context, branchId) {
  const request = context.response.requests.find((candidate) => candidate.fanout?.branch_id === branchId);
  assert.ok(request, `missing ${branchId} request in ${context.runId}`);
  return request;
}

function onlyRequest(context, expectedStepId) {
  assert.equal(context.response.requests.length, 1, `expected one request in ${context.runId}`);
  const request = context.response.requests[0];
  if (expectedStepId !== undefined) assert.equal(request.id, expectedStepId);
  return request;
}

async function instructionsFor(context, request, followUp = false) {
  return await loadInstructions({
    runId: context.runId,
    workflowPath: context.workflowPath,
    runsRoot,
    stepId: request.id,
    followUp,
    leaseToken: context.leaseToken,
  });
}

async function artifactFor(context, request, id, contentType = 'text/markdown') {
  const instructions = await instructionsFor(context, request);
  const outputDirectory = instructions.match(/Artifact output directory for this step: (.+)/)?.[1]?.trim();
  assert.ok(outputDirectory, `instructions for ${request.id} must expose an artifact directory`);
  const extension = contentType === 'application/json' ? 'json' : 'md';
  const artifactPath = path.join(outputDirectory, `${id}.${extension}`);
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${id}\n`, { flag: 'w' });
  const artifact = { id, content_type: contentType, path: artifactPath };
  context.artifacts.push(artifact);
  return artifact;
}

async function writeRequest(context, request, output) {
  const instructions = await instructionsFor(context, request);
  const debugSummaryFile = request.action === 'run_worker'
    ? instructions.match(/--debug-summary-file '([^']+)'/)?.[1]
    : undefined;
  if (request.action === 'run_worker') {
    assert.ok(debugSummaryFile, `instructions for ${request.id} must expose a debug summary path`);
    mkdirSync(path.dirname(debugSummaryFile), { recursive: true });
    writeFileSync(debugSummaryFile, `Deterministic public-run fixture output for ${request.id}.\n`, { flag: 'w' });
  }
  await writeOutput({
    runId: context.runId,
    workflowPath: context.workflowPath,
    runsRoot,
    stepId: request.id,
    json: JSON.stringify(output),
    debugSummaryFile,
    leaseToken: context.leaseToken,
  });
}

async function continueContext(context, bindAgents = []) {
  context.response = await continueRun({
    runId: context.runId,
    workflowPath: context.workflowPath,
    runsRoot,
    bindAgents,
    leaseToken: context.leaseToken,
  });
  context.cursors.push(context.response.baton.cursor);
  return context.response;
}

async function advance(context, output, options = {}) {
  const request = onlyRequest(context, options.expectedStepId);
  await writeRequest(context, request, output);
  const bindAgents = options.workerId === undefined ? [] : [`${request.id}=${options.workerId}`];
  return await continueContext(context, bindAgents);
}

async function advanceFanoutBranches(context, outputsByBranch, workersByBranch = {}) {
  const bindings = [];
  for (const [branchId, outputFactory] of Object.entries(outputsByBranch)) {
    const request = requestByBranch(context, branchId);
    const output = typeof outputFactory === 'function' ? await outputFactory(request) : outputFactory;
    await writeRequest(context, request, output);
    if (workersByBranch[branchId] !== undefined) bindings.push(`${request.id}=${workersByBranch[branchId]}`);
  }
  return await continueContext(context, bindings);
}

async function newPublicRun(workflowName, scenario, userPrompt) {
  const workflowPath = path.join(root, 'workflows', workflowName, 'workflow.toml');
  const runId = `dialectic-${scenario}-${randomUUID()}`;
  const registered = await registerWorkflowRun({ runId, workflowPath, runsRoot, claim: true });
  const response = await next({
    runId,
    workflowPath,
    runsRoot,
    userPrompt,
    leaseToken: registered.leaseToken,
  });
  const runDir = resolveRunPaths({ runId, workflowPath, runsRoot }).runDir;
  return {
    workflowName,
    scenario,
    runId,
    runDir,
    workflowPath,
    leaseToken: registered.leaseToken,
    response,
    cursors: [response.baton.cursor],
    artifacts: [],
  };
}

function cleanAttackVerdict() {
  return { outcome: 'approved', verdict: { summary: ['approved'], evidence_checked: ['fixture'], findings: [] } };
}

function researchOutput(mode, artifact) {
  const dialectic = mode === 'dialectic';
  return {
    outcome: 'ready_for_attack',
    next_step: dialectic ? 'architecture_dialectic_positions' : 'architecture_draft',
    architecture_generation_mode: mode,
    architecture_generation_step: dialectic ? 'architecture_dialectic_positions' : 'architecture_draft',
    summary: `${mode} research route`,
    artifacts: [artifact],
  };
}

async function routeSpddResearch({ scenario, userPrompt, mode }) {
  const context = await newPublicRun('spdd', scenario, userPrompt);
  const researchRequest = onlyRequest(context, 'research_draft');
  const researchInstructions = await instructionsFor(context, researchRequest);
  assert.equal(researchInstructions.includes(userPrompt), true);
  assert.match(researchInstructions, /Explicit direct, omission, or ambiguity means direct/);
  const researchArtifact = await artifactFor(context, researchRequest, 'reasons-canvas-research');
  await advance(context, researchOutput(mode, researchArtifact), { expectedStepId: 'research_draft' });
  await advance(context, cleanAttackVerdict(), { expectedStepId: 'research_attack' });
  await advance(context, { approval: 'approved' }, { expectedStepId: 'approve_research' });
  const expectedCursor = mode === 'dialectic' ? 'architecture_dialectic_positions' : 'architecture_draft';
  assert.equal(context.response.baton.cursor, expectedCursor);
  return context;
}

async function completePositiveSpddDirectRun() {
  const context = await routeSpddResearch({
    scenario: 'spdd-explicit-direct-positive',
    userPrompt: 'Use direct architecture generation.',
    mode: 'direct',
  });
  const architectureRequest = onlyRequest(context, 'architecture_draft');
  const canvas = await artifactFor(context, architectureRequest, 'reasons-canvas-architecture');
  await advance(context, {
    outcome: 'ready_for_attack',
    architecture_generation_mode: 'direct',
    summary: 'direct architecture ready',
    selected_implementation_steps: ['architecture_artifact_update'],
    selected_review_steps: ['architect_review'],
    review_plan: {
      reviewers: [{ step_id: 'architect_review', reason: 'workflow contract', surfaces: ['workflow'], required: true }],
    },
    artifacts: [canvas],
  }, { expectedStepId: 'architecture_draft' });
  await advance(context, cleanAttackVerdict(), { expectedStepId: 'architecture_attack' });
  await advance(context, { approval: 'approved' }, { expectedStepId: 'approve_architecture' });

  let implementationHandoff;
  await advanceFanoutBranches(context, {
    architecture_artifact_update: async (request) => {
      implementationHandoff = await artifactFor(context, request, 'implementation-handoff');
      return {
        outcome: 'implemented',
        summary: 'architecture artifact updated',
        changed_files: ['workflow.toml'],
        verification: [{ command: 'fixture', result: 'passed' }],
        artifacts: [implementationHandoff],
      };
    },
  }, { architecture_artifact_update: 'spdd-implementation-worker' });
  const implementationOwnerRequest = onlyRequest(context, 'implementation');
  const implementationOwnerHandoff = await artifactFor(context, implementationOwnerRequest, 'implementation-handoff');
  await advance(context, {
    outcome: 'ready_for_review',
    summary: 'implementation complete',
    review_branches: ['architect_review'],
    reviewer_handoffs: { architect_review: { summary: 'review workflow contract' } },
    artifacts: [implementationOwnerHandoff],
  }, { expectedStepId: 'implementation' });

  await advanceFanoutBranches(context, {
    architect_review: {
      outcome: 'passed',
      verdict: { summary: ['passed'], evidence_checked: ['implementation handoff'], findings: [] },
    },
  }, { architect_review: 'spdd-review-worker' });
  await advance(context, {
    outcome: 'approved',
    verdict: {
      summary: ['approved'],
      reviewed_branches: ['architect_review'],
      failed_review_branches: [],
      findings: [],
    },
  }, { expectedStepId: 'review' });
  await advance(context, { approval: 'approved' }, { expectedStepId: 'approve_implementation' });
  assert.equal(context.response.status, 'done');
  assert.equal(context.response.baton.cursor, 'done');
  assert.ok(context.response.baton.state.approve_implementation);
  assert.ok(context.response.baton.state.implementation);
  assert.ok(context.response.baton.state.review);
  assert.equal(context.response.baton.state.architecture_dialectic_exit, undefined);
  return context;
}

async function completeNegativeSpddRun() {
  const context = await routeSpddResearch({
    scenario: 'spdd-dialectic-reject-both',
    userPrompt: 'Explicitly use dialectic architecture generation.',
    mode: 'dialectic',
  });
  let visionary;
  let pragmatist;
  await advanceFanoutBranches(context, {
    architecture_visionary_position: async (request) => {
      visionary = await artifactFor(context, request, 'spdd-architecture-visionary-position');
      return { outcome: 'ready_for_freeze', logical_position: 'visionary', position_kind: 'thesis', summary: 'A', evidence_refs: ['research'], fingerprint: architectureFingerprint('A'), artifacts: [visionary] };
    },
    architecture_pragmatist_position: async (request) => {
      pragmatist = await artifactFor(context, request, 'spdd-architecture-pragmatist-position');
      return { outcome: 'ready_for_freeze', logical_position: 'pragmatist', position_kind: 'antithesis', summary: 'B', evidence_refs: ['research'], fingerprint: architectureFingerprint('B'), artifacts: [pragmatist] };
    },
  }, { architecture_visionary_position: 'spdd-visionary-worker' });
  await advance(context, {
    outcome: 'frozen',
    shared_input_artifact: context.artifacts.find((artifact) => artifact.id === 'reasons-canvas-research'),
    positions: [
      { logical_position: 'visionary', artifact: visionary, fingerprint: architectureFingerprint('A'), accepted_output_step_id: 'architecture_visionary_position' },
      { logical_position: 'pragmatist', artifact: pragmatist, fingerprint: architectureFingerprint('B'), accepted_output_step_id: 'architecture_pragmatist_position' },
    ],
  }, { expectedStepId: 'architecture_dialectic_positions' });

  const visionarySynthesisRequest = requestByBranch(context, 'architecture_visionary_synthesis');
  const pragmatistSynthesisRequest = requestByBranch(context, 'architecture_pragmatist_synthesis');
  assert.equal(visionarySynthesisRequest.preferredAgentId, null);
  assert.equal(pragmatistSynthesisRequest.preferredAgentId, null);
  assert.match(await instructionsFor(context, visionarySynthesisRequest), /Artifact output directory for this step/);
  assert.match(await instructionsFor(context, pragmatistSynthesisRequest), /Artifact output directory for this step/);

  let visionarySynthesis;
  let pragmatistSynthesis;
  await advanceFanoutBranches(context, {
    architecture_visionary_synthesis: async (request) => {
      visionarySynthesis = await artifactFor(context, request, 'spdd-architecture-visionary-synthesis');
      return { outcome: 'ready_for_comparison', logical_position: 'visionary', summary: 'A synthesis', source_position_artifact_ids: [visionary.id, pragmatist.id], evidence_refs: ['both'], fingerprint: architectureFingerprint('A'), artifacts: [visionarySynthesis] };
    },
    architecture_pragmatist_synthesis: async (request) => {
      pragmatistSynthesis = await artifactFor(context, request, 'spdd-architecture-pragmatist-synthesis');
      return { outcome: 'ready_for_comparison', logical_position: 'pragmatist', summary: 'B synthesis', source_position_artifact_ids: [visionary.id, pragmatist.id], evidence_refs: ['both'], fingerprint: architectureFingerprint('B'), artifacts: [pragmatistSynthesis] };
    },
  });
  await advance(context, {
    outcome: 'diverged',
    summary: 'material divergence',
    dimension_results: [{ dimension: 'boundaries', aligned: false, evidence: 'different' }],
    material_divergences: ['boundaries'],
    next_step: 'architecture_dialectic_adjudication',
  }, { expectedStepId: 'architecture_dialectic_syntheses' });
  await advance(context, {
    outcome: 'unresolved_with_evidence',
    resolution: 'reject_both',
    summary: 'both candidates rejected',
    unresolved_reasons: ['neither candidate satisfies evidence'],
    synthesis_artifact_ids: [visionarySynthesis.id, pragmatistSynthesis.id],
    evidence_refs: ['research'],
    next_step: 'architecture_dialectic_exit',
  }, { expectedStepId: 'architecture_dialectic_adjudication' });
  const exitRequest = onlyRequest(context, 'architecture_dialectic_exit');
  const unresolvedReport = await artifactFor(context, exitRequest, 'spdd-architecture-unresolved-report');
  await advance(context, {
    outcome: 'unresolved_with_evidence',
    summary: 'architecture unresolved',
    adjudication_ref: 'architecture_dialectic_adjudication',
    evidence_refs: ['research'],
    canonical_proposal_created: false,
    approval_reached: false,
    implementation_reached: false,
    artifacts: [unresolvedReport],
    next_step: 'done',
  }, { expectedStepId: 'architecture_dialectic_exit' });
  assert.equal(context.response.status, 'done');
  assert.equal(context.response.baton.cursor, 'done_unresolved_architecture');
  for (const forbidden of ['architecture_draft', 'approve_architecture', 'implementation', 'review', 'approve_implementation']) {
    assert.equal(context.response.baton.state[forbidden], undefined, `${forbidden} must remain unreachable`);
  }
  return context;
}

async function createArchitectureDirectProbe() {
  const context = await newPublicRun('create-architecture', 'create-direct-scaffold', 'Scaffold an architecture directly.');
  await advance(context, {
    outcome: 'ready_for_context', mode: 'scaffold', implementation_scope: 'implement', architecture_generation_mode: 'direct',
    proposal_generation_step: 'architecture_proposal', next_step: 'context_recovery', summary: 'direct scaffold', representative_asks: ['scaffold'],
    architecture_change_needed: true, current_shape: 'empty', missing_evidence: [], constraints: [], pressure_points: ['boundary'], recommendation: 'continue',
  }, { expectedStepId: 'source_audit' });
  await advance(context, {
    outcome: 'ready_for_options', summary: 'context recovered', recovered_context: ['repository'], open_questions: [],
  }, { expectedStepId: 'context_recovery' });
  const option = (id) => ({ id, summary: id, fit: 'fit', pain_addressed: 'pain', seams: ['seam'], team_changes: [], complexity: ['low'], non_goals: [], required_artifacts: ['proposal'], tradeoffs: ['tradeoff'], failure_mode: 'failure', loses_because: id === 'A' ? null : 'A fits better' });
  await advance(context, {
    outcome: 'ready_for_proposal', architecture_generation_mode: 'direct', summary: 'options narrowed', options: [option('A'), option('B')], recommended_option: 'A',
  }, { expectedStepId: 'option_narrowing' });
  assert.equal(context.response.baton.cursor, 'architecture_proposal');
  assert.equal(context.cursors.includes('proposal_dialectic_positions'), false);
  return context;
}

async function startCreateDialecticAuditRun(scenario) {
  const context = await newPublicRun('create-architecture', scenario, 'Audit with dialectic proposal generation.');
  const sourceRequest = onlyRequest(context, 'source_audit');
  const sharedInput = await artifactFor(context, sourceRequest, 'create-architecture-dialectic-input', 'application/json');
  await advance(context, {
    outcome: 'audit_complete', mode: 'audit', implementation_scope: 'proposal_only', architecture_generation_mode: 'dialectic',
    proposal_generation_step: 'proposal_dialectic_positions', next_step: 'proposal_dialectic_positions', summary: 'dialectic audit', representative_asks: ['audit'],
    architecture_change_needed: true, current_shape: 'current', missing_evidence: [], constraints: ['read only'], pressure_points: ['boundary'], findings: ['finding'], recommendation: 'stop', artifacts: [sharedInput],
  }, { expectedStepId: 'source_audit' });
  let visionary;
  let pragmatist;
  await advanceFanoutBranches(context, {
    proposal_visionary_position: async (request) => {
      visionary = await artifactFor(context, request, 'create-architecture-visionary-position');
      return { outcome: 'ready_for_freeze', logical_position: 'visionary', position_kind: 'thesis', summary: 'A', evidence_refs: ['audit'], fingerprint: architectureFingerprint('A'), artifacts: [visionary] };
    },
    proposal_pragmatist_position: async (request) => {
      pragmatist = await artifactFor(context, request, 'create-architecture-pragmatist-position');
      return { outcome: 'ready_for_freeze', logical_position: 'pragmatist', position_kind: 'antithesis', summary: 'B', evidence_refs: ['audit'], fingerprint: architectureFingerprint('B'), artifacts: [pragmatist] };
    },
  });
  await advance(context, {
    outcome: 'frozen', shared_input_artifact: sharedInput,
    positions: [
      { logical_position: 'visionary', artifact: visionary, fingerprint: architectureFingerprint('A'), accepted_output_step_id: 'proposal_visionary_position' },
      { logical_position: 'pragmatist', artifact: pragmatist, fingerprint: architectureFingerprint('B'), accepted_output_step_id: 'proposal_pragmatist_position' },
    ],
  }, { expectedStepId: 'proposal_dialectic_positions' });
  let visionarySynthesis;
  let pragmatistSynthesis;
  await advanceFanoutBranches(context, {
    proposal_visionary_synthesis: async (request) => {
      visionarySynthesis = await artifactFor(context, request, 'create-architecture-visionary-synthesis');
      return { outcome: 'ready_for_comparison', logical_position: 'visionary', summary: 'A synthesis', source_position_artifact_ids: [visionary.id, pragmatist.id], evidence_refs: ['both'], fingerprint: architectureFingerprint('A'), artifacts: [visionarySynthesis] };
    },
    proposal_pragmatist_synthesis: async (request) => {
      pragmatistSynthesis = await artifactFor(context, request, 'create-architecture-pragmatist-synthesis');
      return { outcome: 'ready_for_comparison', logical_position: 'pragmatist', summary: 'B synthesis', source_position_artifact_ids: [visionary.id, pragmatist.id], evidence_refs: ['both'], fingerprint: architectureFingerprint('B'), artifacts: [pragmatistSynthesis] };
    },
  });
  await advance(context, { outcome: 'diverged', summary: 'different', dimension_results: [{ dimension: 'boundaries', aligned: false, evidence: 'different' }], material_divergences: ['boundaries'], next_step: 'proposal_dialectic_adjudication' }, { expectedStepId: 'proposal_dialectic_syntheses' });
  return { context, visionary, pragmatist, visionarySynthesis, pragmatistSynthesis };
}

async function completeCreateDialecticAuditRun() {
  const state = await startCreateDialecticAuditRun('create-dialectic-audit');
  const { context, visionary, pragmatist, visionarySynthesis, pragmatistSynthesis } = state;
  const lineage = { position_artifact_ids: [visionary.id, pragmatist.id], synthesis_artifact_ids: [visionarySynthesis.id, pragmatistSynthesis.id], selected_candidate: 'visionary' };
  await advance(context, { outcome: 'adjudicated', resolution: 'select_visionary', summary: 'select A', decision_basis: 'evidence', canonical_lineage: lineage, synthesis_artifact_ids: lineage.synthesis_artifact_ids, evidence_refs: ['audit'], next_step: 'architecture_proposal' }, { expectedStepId: 'proposal_dialectic_adjudication' });
  const proposalRequest = onlyRequest(context, 'architecture_proposal');
  const proposal = await artifactFor(context, proposalRequest, 'architecture-proposal');
  await advance(context, {
    outcome: 'ready_for_review', summary: 'proposal', selected_direction: 'A', mode: 'audit', architecture_generation_mode: 'dialectic',
    dialectic_lineage: { ...lineage, convergence_outcome: 'diverged', adjudication_id: 'proposal_dialectic_adjudication', canonical_logical_owner: 'create_architecture_owner' },
    artifact_scope: ['proposal only'], implementation_scope: 'proposal_only', next_step: 'done', artifacts: [proposal],
  }, { expectedStepId: 'architecture_proposal' });
  await advance(context, { outcome: 'reviewed', verdict: { status: 'pass', summary: 'pass', evidence_checked: ['fixture'], findings: [] } }, { expectedStepId: 'architect_review' });
  await advance(context, { outcome: 'approved', gate_summary: 'approved', verdict: { summary: 'pass', evidence_checked: ['fixture'], findings: [] } }, { expectedStepId: 'critic_pressure' });
  await advance(context, { outcome: 'ready_for_approval', summary: 'ready', unresolved_findings: [] }, { expectedStepId: 'proposal_review_exit' });
  await advance(context, { approval: 'approved' }, { expectedStepId: 'approve_architecture' });
  assert.equal(context.response.status, 'done');
  assert.equal(context.cursors.includes('architecture_implementation'), false);
  assert.equal(context.cursors.filter((cursor) => cursor === 'proposal_dialectic_adjudication').length, 1);
  return context;
}

async function completeNegativeCreateRun() {
  const state = await startCreateDialecticAuditRun('create-dialectic-reject-both');
  const { context, visionarySynthesis, pragmatistSynthesis } = state;
  await advance(context, {
    outcome: 'unresolved_with_evidence',
    resolution: 'reject_both',
    summary: 'both candidates rejected',
    unresolved_reasons: ['neither candidate satisfies the audit evidence'],
    synthesis_artifact_ids: [visionarySynthesis.id, pragmatistSynthesis.id],
    evidence_refs: ['audit'],
    next_step: 'proposal_dialectic_exit',
  }, { expectedStepId: 'proposal_dialectic_adjudication' });
  const exitRequest = onlyRequest(context, 'proposal_dialectic_exit');
  const unresolvedReport = await artifactFor(context, exitRequest, 'create-architecture-unresolved-report');
  await advance(context, {
    outcome: 'unresolved_with_evidence',
    summary: 'architecture proposal unresolved',
    adjudication_ref: 'proposal_dialectic_adjudication',
    evidence_refs: ['audit'],
    canonical_proposal_created: false,
    approval_reached: false,
    implementation_reached: false,
    artifacts: [unresolvedReport],
    next_step: 'done',
  }, { expectedStepId: 'proposal_dialectic_exit' });
  assert.equal(context.response.status, 'done');
  assert.equal(context.response.baton.cursor, 'done');
  for (const forbidden of ['architecture_proposal', 'architect_review', 'critic_pressure', 'proposal_review_exit', 'approve_architecture', 'architecture_implementation', 'implementation_review_join', 'approve_implementation']) {
    assert.equal(context.response.baton.state[forbidden], undefined, `${forbidden} must remain unreachable`);
  }
  return context;
}

async function startHegelRun(scenario) {
  const context = await newPublicRun('hegel', scenario, 'Diagnose the fixture read-only.');
  const intakeRequest = onlyRequest(context, 'diagnostic_intake');
  const brief = await artifactFor(context, intakeRequest, 'hegel-diagnostic-brief');
  await advance(context, {
    outcome: 'ready_for_positions', topic: 'fixture', diagnostic_question: 'Which model fits?', known_constraints: ['read only'],
    evidence_requirements: ['local evidence'], source_requirements: ['repository'],
    stopping_budget: { dialectic_cycles: 1, max_adjudications: 1, max_hostile_reviews: 2 }, mutation_policy: 'read_only', artifacts: [brief],
  }, { expectedStepId: 'diagnostic_intake' });
  let visionary;
  let pragmatist;
  await advanceFanoutBranches(context, {
    diagnostic_visionary_position: async (request) => {
      visionary = await artifactFor(context, request, 'hegel-visionary-position');
      return { outcome: 'ready_for_freeze', logical_position: 'visionary', position_kind: 'thesis', summary: 'A', evidence_refs: ['repo'], fingerprint: diagnosticFingerprint('A'), artifacts: [visionary] };
    },
    diagnostic_pragmatist_position: async (request) => {
      pragmatist = await artifactFor(context, request, 'hegel-pragmatist-position');
      return { outcome: 'ready_for_freeze', logical_position: 'pragmatist', position_kind: 'antithesis', summary: 'B', evidence_refs: ['repo'], fingerprint: diagnosticFingerprint('B'), artifacts: [pragmatist] };
    },
  });
  await advance(context, { outcome: 'frozen', shared_input_artifact: brief, positions: [
    { logical_position: 'visionary', artifact: visionary, fingerprint: diagnosticFingerprint('A'), accepted_output_step_id: 'diagnostic_visionary_position' },
    { logical_position: 'pragmatist', artifact: pragmatist, fingerprint: diagnosticFingerprint('B'), accepted_output_step_id: 'diagnostic_pragmatist_position' },
  ] }, { expectedStepId: 'diagnostic_positions' });
  let visionarySynthesis;
  let pragmatistSynthesis;
  await advanceFanoutBranches(context, {
    diagnostic_visionary_synthesis: async (request) => {
      visionarySynthesis = await artifactFor(context, request, 'hegel-visionary-synthesis');
      return { outcome: 'ready_for_comparison', logical_position: 'visionary', summary: 'A synthesis', source_position_artifact_ids: [visionary.id, pragmatist.id], evidence_refs: ['both'], fingerprint: diagnosticFingerprint('A'), artifacts: [visionarySynthesis] };
    },
    diagnostic_pragmatist_synthesis: async (request) => {
      pragmatistSynthesis = await artifactFor(context, request, 'hegel-pragmatist-synthesis');
      return { outcome: 'ready_for_comparison', logical_position: 'pragmatist', summary: 'B synthesis', source_position_artifact_ids: [visionary.id, pragmatist.id], evidence_refs: ['both'], fingerprint: diagnosticFingerprint('B'), artifacts: [pragmatistSynthesis] };
    },
  });
  return { context, visionary, pragmatist, visionarySynthesis, pragmatistSynthesis };
}

async function completeNegativeHegelRun() {
  const state = await startHegelRun('hegel-negative-review-exhaustion');
  const { context, visionary, pragmatist, visionarySynthesis, pragmatistSynthesis } = state;
  await advance(context, { outcome: 'diverged', summary: 'different', dimension_results: [{ dimension: 'causal_model', aligned: false, evidence: 'different' }], material_divergences: ['causal model'], next_step: 'diagnostic_adjudication' }, { expectedStepId: 'diagnostic_syntheses' });
  await advance(context, { outcome: 'unresolved_with_evidence', resolution: 'reject_both', summary: 'reject both', unresolved_reasons: ['both unsupported'], synthesis_artifact_ids: [visionarySynthesis.id, pragmatistSynthesis.id], evidence_refs: ['repo'], next_step: 'diagnostic_report' }, { expectedStepId: 'diagnostic_adjudication' });
  const reportRequest = onlyRequest(context, 'diagnostic_report');
  const report = await artifactFor(context, reportRequest, 'diagnostic-report');
  const reportOutput = { outcome: 'unresolved_with_evidence', summary: 'unresolved', facts: ['fact'], inferences: [], unresolved_contradictions: ['contradiction'], rejected_models: ['A', 'B'], canonical_synthesis: null, unresolved_reason: 'reject both', confidence: { level: 'low', rationale: 'insufficient support' }, cheapest_falsifying_next_experiment: 'collect discriminating evidence', dialectic_lineage: { position_artifact_ids: [visionary.id, pragmatist.id], synthesis_artifact_ids: [visionarySynthesis.id, pragmatistSynthesis.id], convergence_outcome: 'diverged', adjudication_id: 'diagnostic_adjudication', resolution: 'reject_both', canonical_logical_owner: 'hegel_diagnostic_owner' }, artifacts: [report] };
  const finding = { category: 'source_support', severity: 'must_fix', evidence: 'gap', action: 'preserve unresolved' };
  await advance(context, reportOutput, { expectedStepId: 'diagnostic_report' });
  await advance(context, { outcome: 'needs_revision', summary: 'revise', checked_evidence: ['report'], findings: [finding], next_step: 'diagnostic_report' }, { expectedStepId: 'diagnostic_hostile_review' });
  await advance(context, reportOutput, { expectedStepId: 'diagnostic_report' });
  await advance(context, { outcome: 'needs_revision', summary: 'still unresolved', checked_evidence: ['report'], findings: [finding], next_step: 'diagnostic_report' }, { expectedStepId: 'diagnostic_hostile_review' });
  assert.equal(context.response.baton.cursor, 'diagnostic_review_exit');
  await advance(context, { outcome: 'review_exhausted', final_classification: 'unresolved_with_evidence', summary: 'bounded review exhausted', latest_diagnostic_report: report, latest_hostile_findings: [finding], review_iteration_count: 2, next_step: 'done' }, { expectedStepId: 'diagnostic_review_exit' });
  assert.equal(context.response.status, 'done');
  assert.equal(context.cursors.filter((cursor) => cursor === 'diagnostic_adjudication').length, 1);
  assert.equal(context.cursors.filter((cursor) => cursor === 'diagnostic_hostile_review').length, 2);
  return context;
}

async function completePositiveHegelAdjudicationRun() {
  const state = await startHegelRun('hegel-positive-adjudication');
  const { context, visionary, pragmatist, visionarySynthesis, pragmatistSynthesis } = state;
  await advance(context, { outcome: 'diverged', summary: 'different', dimension_results: [{ dimension: 'causal_model', aligned: false, evidence: 'different' }], material_divergences: ['causal model'], next_step: 'diagnostic_adjudication' }, { expectedStepId: 'diagnostic_syntheses' });
  const lineage = { position_artifact_ids: [visionary.id, pragmatist.id], synthesis_artifact_ids: [visionarySynthesis.id, pragmatistSynthesis.id], selected_candidate: 'visionary' };
  await advance(context, { outcome: 'adjudicated', resolution: 'select_visionary', summary: 'select A', decision_basis: 'evidence', canonical_lineage: lineage, synthesis_artifact_ids: lineage.synthesis_artifact_ids, evidence_refs: ['repo'], next_step: 'diagnostic_report' }, { expectedStepId: 'diagnostic_adjudication' });
  const reportRequest = onlyRequest(context, 'diagnostic_report');
  const report = await artifactFor(context, reportRequest, 'diagnostic-report');
  await advance(context, { outcome: 'diagnosis_complete', summary: 'diagnosis complete', facts: ['fact'], inferences: ['inference'], unresolved_contradictions: [], rejected_models: ['B'], canonical_synthesis: 'A', confidence: { level: 'high', rationale: 'supported' }, cheapest_falsifying_next_experiment: 'test A', dialectic_lineage: { position_artifact_ids: lineage.position_artifact_ids, synthesis_artifact_ids: lineage.synthesis_artifact_ids, convergence_outcome: 'diverged', adjudication_id: 'diagnostic_adjudication', resolution: 'selected_visionary', canonical_logical_owner: 'hegel_diagnostic_owner' }, artifacts: [report] }, { expectedStepId: 'diagnostic_report' });
  await advance(context, { outcome: 'approved', summary: 'supported', checked_evidence: ['report'], findings: [], next_step: 'done' }, { expectedStepId: 'diagnostic_hostile_review' });
  assert.equal(context.response.status, 'done');
  assert.equal(context.cursors.filter((cursor) => cursor === 'diagnostic_adjudication').length, 1);
  assert.equal(context.cursors.includes('diagnostic_review_exit'), false);
  return context;
}

function evidenceRecord(context) {
  const historyPath = path.join(context.runDir, 'history.md');
  assert.equal(existsSync(historyPath), true);
  const history = readFileSync(historyPath, 'utf8');
  assert.match(history, /source: workflow-runner/);
  assert.match(history, /output: accepted:/);
  for (const artifact of context.artifacts) assert.equal(existsSync(artifact.path), true, artifact.path);
  return {
    component: context.workflowName,
    scenario: context.scenario,
    run_id: context.runId,
    status: context.response.status,
    cursor: context.response.baton.cursor,
    history_path: historyPath,
    history_bytes: Buffer.byteLength(history),
    artifact_refs: context.artifacts,
  };
}

test('canonical public-run evidence covers scripted selectors, routes, adjudication, and fallback requests', async () => {
  const omitted = await routeSpddResearch({ scenario: 'spdd-selector-omitted', userPrompt: 'Design the architecture.', mode: 'direct' });
  const ambiguous = await routeSpddResearch({ scenario: 'spdd-selector-ambiguous', userPrompt: 'Use direct or dialectic, whichever.', mode: 'direct' });
  const positiveSpdd = await completePositiveSpddDirectRun();
  const negativeSpdd = await completeNegativeSpddRun();
  const directCreate = await createArchitectureDirectProbe();
  const dialecticCreate = await completeCreateDialecticAuditRun();
  const negativeCreate = await completeNegativeCreateRun();
  const negativeHegel = await completeNegativeHegelRun();
  const positiveHegel = await completePositiveHegelAdjudicationRun();

  assert.equal(omitted.response.baton.cursor, 'architecture_draft');
  assert.equal(ambiguous.response.baton.cursor, 'architecture_draft');
  assert.equal(positiveSpdd.response.baton.cursor, 'done');
  assert.equal(negativeSpdd.response.baton.cursor, 'done_unresolved_architecture');
  assert.equal(directCreate.response.baton.cursor, 'architecture_proposal');
  assert.equal(dialecticCreate.response.baton.cursor, 'done');
  assert.equal(negativeCreate.response.baton.cursor, 'done');
  assert.equal(negativeHegel.response.baton.cursor, 'done');
  assert.equal(positiveHegel.response.baton.cursor, 'done');

  const records = [omitted, ambiguous, positiveSpdd, negativeSpdd, directCreate, dialecticCreate, negativeCreate, negativeHegel, positiveHegel].map(evidenceRecord);
  const manifest = {
    evidence_version: 1,
    evidence_layers: {
      static_schema_and_graph: 'Covered separately by dialectic-workflows-contract.test.mjs.',
      public_runner: 'All records below were registered and advanced through the production workflow runner API with durable baton and history writes.',
      host_worker_request_generation: 'SPDD synthesis requests show the public host requested fresh workers when no restorable binding was projected; this does not prove worker execution.',
      physical_worker_execution: 'Not exercised by this deterministic suite; selector normalization and synthesis outputs are scripted fixtures.',
    },
    isolated_workflow_runs_root: runsRoot,
    retained_for_comparison: preserveEvidence,
    canonical_components: {
      spdd: negativeSpdd.runId,
      create_architecture: dialecticCreate.runId,
      hegel: negativeHegel.runId,
    },
    additional_behavior_runs: records
      .filter((record) => ![negativeSpdd.runId, dialecticCreate.runId, negativeHegel.runId].includes(record.run_id))
      .map((record) => record.run_id),
    runs: records,
    source_tree_artifact_leak_check: {
      repository_root: !existsSync(path.join(root, '.workflow-runs')),
      orbita_skill: !existsSync(path.join(root, 'skills/orbita/.workflow-runs')),
      workflows: !existsSync(path.join(root, 'workflows/.workflow-runs')),
    },
  };
  assert.deepEqual(manifest.source_tree_artifact_leak_check, { repository_root: true, orbita_skill: true, workflows: true });
  writeFileSync(path.join(runsRoot, 'dialectic-smoke-evidence.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'w' });
});
