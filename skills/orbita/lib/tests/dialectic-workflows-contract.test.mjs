import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, test } from 'bun:test';
import { assertJsonSchema } from '../../../../shared/scripts/schema-validation/schema-validation.mjs';
import { batonSchema } from '../file-contracts/baton/baton-schema.mjs';
import { readWorkflowDocument } from '../persistence/workflow-resources/workflow-document-reader.mjs';
import { loadWorkflowResources } from '../persistence/workflow-resources/runtime-reader.mjs';
import { applyWorkflowOutput } from '../runtime/workflow-output/apply.mjs';
import { readWorkflowCatalog } from '../workflow-catalog-reader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const isolatedRunsRoot = mkdtempSync(path.join(tmpdir(), 'dialectic-workflows-smoke-'));
afterAll(() => rmSync(isolatedRunsRoot, { recursive: true, force: true }));

function workflow(name) {
  return readWorkflowDocument(path.join(root, 'workflows', name, 'workflow.toml'));
}

function schema(workflowName, filename) {
  return JSON.parse(readFileSync(path.join(root, 'workflows', workflowName, 'schemas', filename), 'utf8'));
}

function prompt(step) {
  return Array.isArray(step.input?.prompt) ? step.input.prompt.join('\n') : (step.input?.prompt ?? '');
}

function artifact(id) {
  return { id, content_type: 'text/markdown', path: `/tmp/${id}.md` };
}

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

function smokeContext(name) {
  const workflowPath = path.join(root, 'workflows', name, 'workflow.toml');
  const workflowDoc = workflow(name);
  const runDir = path.join(isolatedRunsRoot, name);
  mkdirSync(runDir, { recursive: true });
  return {
    workflowDoc,
    resources: loadWorkflowResources({ workflow: workflowDoc, workflowPath, repositoryRoot: root, runDir }),
    runDir,
    baton: { cursor: workflowDoc.start, status: 'running', state: { artifacts: [], results: [] } },
    response: undefined,
    cursors: [workflowDoc.start],
  };
}

function smokeArtifact(context, stepId, id, contentType = 'text/markdown') {
  const extension = contentType === 'application/json' ? 'json' : 'md';
  const artifactPath = path.join(context.runDir, stepId, 'artifacts', `${id}.${extension}`);
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${id}\n`);
  return { id, content_type: contentType, path: artifactPath };
}

function applySmokeOutput(context, outputValue) {
  context.response = applyWorkflowOutput({ workflowDoc: context.workflowDoc, batonDoc: context.baton, outputValue, resources: context.resources });
  context.baton = context.response.baton;
  context.cursors.push(context.baton.cursor);
  return context.response;
}

function applyFanoutBranches(context, outputsByBranch) {
  const steps = {};
  for (const entry of context.response.steps) steps[entry.id] = outputsByBranch[entry.fanout.branch_id];
  return applySmokeOutput(context, { steps });
}

function cleanAttackVerdict() {
  return { outcome: 'approved', verdict: { summary: ['approved'], evidence_checked: ['fixture'], findings: [] } };
}

function cleanArchitectReview() {
  return { outcome: 'reviewed', verdict: { status: 'pass', summary: 'pass', evidence_checked: ['fixture'], findings: [] } };
}

function cleanCriticReview() {
  return { outcome: 'approved', gate_summary: 'approved', verdict: { summary: 'pass', evidence_checked: ['fixture'], findings: [] } };
}

test('catalog exposes optional workflow displayName without changing identity or fallback', () => {
  const catalog = readWorkflowCatalog({ workflowsRoot: path.join(root, 'workflows') });
  const hegel = catalog.find((entry) => entry.name === 'hegel');
  const spdd = catalog.find((entry) => entry.name === 'spdd');
  assert.equal(hegel.displayName, 'Hegel');
  assert.equal(hegel.relativePath, 'hegel');
  assert.equal(spdd.displayName, 'spdd');
});

test('SPDD preserves direct compatibility and inserts one artifact-only dialectic cycle', () => {
  const doc = workflow('spdd');
  const researchPrompt = prompt(doc.steps.research_draft);
  assert.match(researchPrompt, /Explicit direct, omission, or ambiguity means direct/);
  assert.equal(doc.steps.approve_ui_intent.next, '${{ input.research_draft.architecture_generation_step }}');
  assert.deepEqual(doc.steps.architecture_dialectic_positions.input.branches, ['architecture_visionary_position', 'architecture_pragmatist_position']);
  assert.deepEqual(doc.steps.architecture_dialectic_syntheses.input.branches, ['architecture_visionary_synthesis', 'architecture_pragmatist_synthesis']);
  assert.equal(doc.steps.architecture_dialectic_positions.branches.architecture_visionary_position.agent, 'spdd_architecture_visionary');
  assert.equal(doc.steps.architecture_dialectic_syntheses.branches.architecture_visionary_synthesis.agent, 'spdd_architecture_visionary');
  assert.equal(doc.steps.architecture_dialectic_positions.branches.architecture_pragmatist_position.agent, 'spdd_architecture_pragmatist');
  assert.equal(doc.steps.architecture_dialectic_syntheses.branches.architecture_pragmatist_synthesis.agent, 'spdd_architecture_pragmatist');
  assert.notEqual(doc.steps.architecture_dialectic_syntheses.agent, doc.steps.architecture_dialectic_adjudication.agent);
  assert.equal(doc.steps.architecture_dialectic_exit.next.cases.done, 'done_unresolved_architecture');
  assert.match(prompt(doc.steps.architecture_dialectic_exit), /without creating.*approval, implementation, or review/i);
  assert.match(prompt(doc.steps.done_unresolved_architecture), /Project only the typed architecture_dialectic_exit result/);
  assert.doesNotMatch(prompt(doc.steps.done_unresolved_architecture), /Workflow completed only because the user explicitly approved/);
  assert.doesNotMatch(prompt(doc.steps.done), /architecture_dialectic_exit/);
  assert.match(prompt(doc.steps.architecture_dialectic_syntheses.branches.architecture_visionary_synthesis), /fresh worker/);
  assert.doesNotMatch(prompt(doc.steps.architecture_dialectic_syntheses.branches.architecture_visionary_synthesis), /Pragmatist synthesis:/);
});

test('SPDD selector schema closes direct and dialectic route combinations', () => {
  const outputSchema = schema('spdd', 'research-draft-output.json');
  const base = {
    outcome: 'ready_for_attack',
    summary: 'ready',
    artifacts: [artifact('reasons-canvas-research')],
  };
  assert.doesNotThrow(() => assertJsonSchema(outputSchema, { ...base, architecture_generation_mode: 'direct', architecture_generation_step: 'architecture_draft', next_step: 'architecture_draft' }, 'direct research', { schemas: [batonSchema] }));
  assert.doesNotThrow(() => assertJsonSchema(outputSchema, { ...base, architecture_generation_mode: 'dialectic', architecture_generation_step: 'architecture_dialectic_positions', next_step: 'architecture_dialectic_positions' }, 'dialectic research', { schemas: [batonSchema] }));
  assert.throws(() => assertJsonSchema(outputSchema, { ...base, architecture_generation_mode: 'direct', architecture_generation_step: 'architecture_dialectic_positions', next_step: 'architecture_dialectic_positions' }, 'invalid research', { schemas: [batonSchema] }));
});

test('create-architecture keeps direct audit terminal and dialectic audit proposal-only', () => {
  const doc = workflow('create-architecture');
  assert.match(prompt(doc.steps.source_audit), /omission, or ambiguity means direct/);
  assert.equal(doc.steps.source_audit.next.cases.done, 'done');
  assert.equal(doc.steps.source_audit.next.cases.proposal_dialectic_positions, 'proposal_dialectic_positions');
  assert.equal(doc.steps.option_narrowing.next.match, '${{ input.source_audit.proposal_generation_step }}');
  assert.equal(doc.steps.architecture_proposal.agent, 'create_architecture_owner');
  assert.equal(doc.steps.proposal_dialectic_positions.branches.proposal_visionary_position.agent, doc.steps.proposal_dialectic_syntheses.branches.proposal_visionary_synthesis.agent);
  assert.equal(doc.steps.proposal_dialectic_positions.branches.proposal_pragmatist_position.agent, doc.steps.proposal_dialectic_syntheses.branches.proposal_pragmatist_synthesis.agent);
  assert.match(prompt(doc.steps.architecture_proposal), /Audit is permitted only for dialectic mode, remains proposal_only/);
  assert.match(prompt(doc.steps.proposal_dialectic_exit), /without producing.*approval, or implementation/);

  const sourceSchema = schema('create-architecture', 'source-audit-output.json');
  const base = {
    outcome: 'audit_complete', mode: 'audit', implementation_scope: 'proposal_only', summary: 'audit', representative_asks: ['ask'],
    architecture_change_needed: false, current_shape: 'shape', missing_evidence: [], constraints: [], pressure_points: [], findings: ['finding'], recommendation: 'stop',
  };
  assert.doesNotThrow(() => assertJsonSchema(sourceSchema, { ...base, architecture_generation_mode: 'direct', proposal_generation_step: 'architecture_proposal', next_step: 'done' }, 'direct audit', { schemas: [batonSchema] }));
  assert.doesNotThrow(() => assertJsonSchema(sourceSchema, { ...base, architecture_generation_mode: 'dialectic', proposal_generation_step: 'proposal_dialectic_positions', next_step: 'proposal_dialectic_positions', artifacts: [{ id: 'create-architecture-dialectic-input', content_type: 'application/json', path: '/tmp/create-architecture-dialectic-input.json' }] }, 'dialectic audit', { schemas: [batonSchema] }));
  assert.throws(() => assertJsonSchema(sourceSchema, { ...base, architecture_generation_mode: 'direct', proposal_generation_step: 'architecture_proposal', next_step: 'proposal_dialectic_positions' }, 'invalid audit', { schemas: [batonSchema] }));
});

test('package schemas reject peer-synthesis leakage and unresolved architecture exits that claim progress', () => {
  const synthesisSchema = schema('spdd', 'dialectic-visionary-synthesis-output.json');
  const synthesis = {
    outcome: 'ready_for_comparison', logical_position: 'visionary', summary: 'candidate', source_position_artifact_ids: ['a', 'b'],
    evidence_refs: ['evidence'], fingerprint: architectureFingerprint(), artifacts: [artifact('spdd-architecture-visionary-synthesis')],
  };
  assert.doesNotThrow(() => assertJsonSchema(synthesisSchema, synthesis, 'visionary synthesis', { schemas: [batonSchema] }));
  assert.throws(() => assertJsonSchema(synthesisSchema, { ...synthesis, peer_synthesis: 'forbidden' }, 'leaked synthesis', { schemas: [batonSchema] }));

  const exitSchema = schema('create-architecture', 'dialectic-exit-output.json');
  const unresolved = {
    outcome: 'unresolved_with_evidence', summary: 'no viable synthesis', adjudication_ref: 'adjudication', evidence_refs: ['evidence'],
    canonical_proposal_created: false, approval_reached: false, implementation_reached: false,
    artifacts: [artifact('create-architecture-unresolved-report')], next_step: 'done',
  };
  assert.doesNotThrow(() => assertJsonSchema(exitSchema, unresolved, 'unresolved exit', { schemas: [batonSchema] }));
  assert.throws(() => assertJsonSchema(exitSchema, { ...unresolved, approval_reached: true }, 'invalid unresolved exit', { schemas: [batonSchema] }));
});

test('Hegel is bounded, read-only, independently reviewed, and honestly unresolved on exhaustion', () => {
  const doc = workflow('hegel');
  assert.equal(doc.name, 'hegel');
  assert.equal(doc.displayName, 'Hegel');
  assert.deepEqual(doc.loopPolicies.diagnostic_report_review, {
    steps: ['diagnostic_report', 'diagnostic_hostile_review'], entry: 'diagnostic_report', boundary: 'diagnostic_hostile_review', maxIterations: 2, onLimit: 'diagnostic_review_exit',
  });
  assert.equal(Object.values(doc.steps).some((step) => step.kind === 'approval'), false);
  assert.equal(Object.keys(doc.steps).some((stepId) => stepId.includes('implementation')), false);
  assert.notEqual(doc.steps.diagnostic_syntheses.agent, doc.steps.diagnostic_adjudication.agent);
  assert.notEqual(doc.steps.diagnostic_adjudication.agent, doc.steps.diagnostic_hostile_review.agent);
  assert.equal(doc.steps.diagnostic_review_exit.next.cases.done, 'done');
  assert.match(prompt(doc.steps.diagnostic_review_exit), /Do not run another review, another dialectic round, or a non-blocking stop/);
  const authoredPrompts = Object.values(doc.steps).flatMap((step) => [prompt(step), ...Object.values(step.branches ?? {}).map(prompt)]).join('\n');
  assert.match(authoredPrompts, /Stay read-only/);
  assert.doesNotMatch(authoredPrompts, /You may (?:edit|implement|publish|post|mutate)/i);

  const reportSchema = schema('hegel', 'diagnostic-report-output.json');
  const unresolved = {
    outcome: 'unresolved_with_evidence', summary: 'models rejected', facts: ['fact'], inferences: [], unresolved_contradictions: ['conflict'], rejected_models: ['A', 'B'], canonical_synthesis: null,
    unresolved_reason: 'reject both', confidence: { level: 'low', rationale: 'conflict remains' }, cheapest_falsifying_next_experiment: 'collect one discriminating observation',
    dialectic_lineage: { position_artifact_ids: ['a', 'b'], synthesis_artifact_ids: ['c', 'd'], convergence_outcome: 'diverged', adjudication_id: 'e', resolution: 'reject_both', canonical_logical_owner: 'hegel_diagnostic_owner' },
    artifacts: [artifact('diagnostic-report')],
  };
  assert.doesNotThrow(() => assertJsonSchema(reportSchema, unresolved, 'unresolved report', { schemas: [batonSchema] }));
  assert.throws(() => assertJsonSchema(reportSchema, { ...unresolved, unresolved_contradictions: [] }, 'empty unresolved evidence', { schemas: [batonSchema] }));
});

test('static runtime transition fixture covers SPDD rejoin, dialectic audit, and Hegel negative terminal', () => {
  const spdd = smokeContext('spdd');
  const researchArtifact = smokeArtifact(spdd, 'research_draft', 'reasons-canvas-research');
  applySmokeOutput(spdd, {
    outcome: 'ready_for_attack', next_step: 'architecture_dialectic_positions', architecture_generation_mode: 'dialectic',
    architecture_generation_step: 'architecture_dialectic_positions', summary: 'dialectic research', artifacts: [researchArtifact],
  });
  applySmokeOutput(spdd, cleanAttackVerdict());
  applySmokeOutput(spdd, { approval: 'approved' });
  const spddVisionary = smokeArtifact(spdd, 'architecture_visionary_position', 'spdd-architecture-visionary-position');
  const spddPragmatist = smokeArtifact(spdd, 'architecture_pragmatist_position', 'spdd-architecture-pragmatist-position');
  applyFanoutBranches(spdd, {
    architecture_visionary_position: { outcome: 'ready_for_freeze', logical_position: 'visionary', position_kind: 'thesis', summary: 'A', evidence_refs: ['research'], fingerprint: architectureFingerprint('A'), artifacts: [spddVisionary] },
    architecture_pragmatist_position: { outcome: 'ready_for_freeze', logical_position: 'pragmatist', position_kind: 'antithesis', summary: 'B', evidence_refs: ['research'], fingerprint: architectureFingerprint('B'), artifacts: [spddPragmatist] },
  });
  applySmokeOutput(spdd, {
    outcome: 'frozen', shared_input_artifact: researchArtifact,
    positions: [
      { logical_position: 'visionary', artifact: spddVisionary, fingerprint: architectureFingerprint('A'), accepted_output_step_id: 'architecture_visionary_position' },
      { logical_position: 'pragmatist', artifact: spddPragmatist, fingerprint: architectureFingerprint('B'), accepted_output_step_id: 'architecture_pragmatist_position' },
    ],
  });
  const spddVisionarySynthesis = smokeArtifact(spdd, 'architecture_visionary_synthesis', 'spdd-architecture-visionary-synthesis');
  const spddPragmatistSynthesis = smokeArtifact(spdd, 'architecture_pragmatist_synthesis', 'spdd-architecture-pragmatist-synthesis');
  applyFanoutBranches(spdd, {
    architecture_visionary_synthesis: { outcome: 'ready_for_comparison', logical_position: 'visionary', summary: 'A synthesis', source_position_artifact_ids: [spddVisionary.id, spddPragmatist.id], evidence_refs: ['both'], fingerprint: architectureFingerprint('same'), artifacts: [spddVisionarySynthesis] },
    architecture_pragmatist_synthesis: { outcome: 'ready_for_comparison', logical_position: 'pragmatist', summary: 'B synthesis', source_position_artifact_ids: [spddVisionary.id, spddPragmatist.id], evidence_refs: ['both'], fingerprint: architectureFingerprint('same'), artifacts: [spddPragmatistSynthesis] },
  });
  const spddLineage = { position_artifact_ids: [spddVisionary.id, spddPragmatist.id], synthesis_artifact_ids: [spddVisionarySynthesis.id, spddPragmatistSynthesis.id], selected_candidate: 'visionary' };
  applySmokeOutput(spdd, { outcome: 'converged', summary: 'aligned', dimension_results: [{ dimension: 'boundaries', aligned: true, evidence: 'same' }], material_divergences: [], selected_candidate: 'visionary', canonical_lineage: spddLineage, next_step: 'architecture_draft' });
  const canvas = smokeArtifact(spdd, 'architecture_draft', 'reasons-canvas-architecture');
  applySmokeOutput(spdd, {
    outcome: 'ready_for_attack', architecture_generation_mode: 'dialectic',
    dialectic_lineage: { ...spddLineage, convergence_outcome: 'converged', canonical_logical_owner: 'spdd_architecture_owner' },
    summary: 'canvas ready', selected_implementation_steps: ['architecture_artifact_update'], selected_review_steps: ['architect_review'],
    review_plan: { reviewers: [{ step_id: 'architect_review', reason: 'workflow contracts changed', surfaces: ['workflow'], required: true }] }, artifacts: [canvas],
  });
  applySmokeOutput(spdd, cleanAttackVerdict());
  assert.equal(spdd.baton.cursor, 'approve_architecture');
  assert.equal(spdd.cursors.includes('architecture_attack'), true);
  assert.equal(spdd.cursors.includes('implementation'), false);

  const createArchitecture = smokeContext('create-architecture');
  const createSharedInput = smokeArtifact(createArchitecture, 'source_audit', 'create-architecture-dialectic-input', 'application/json');
  applySmokeOutput(createArchitecture, {
    outcome: 'audit_complete', mode: 'audit', implementation_scope: 'proposal_only', architecture_generation_mode: 'dialectic',
    proposal_generation_step: 'proposal_dialectic_positions', next_step: 'proposal_dialectic_positions', summary: 'dialectic audit', representative_asks: ['audit'],
    architecture_change_needed: true, current_shape: 'current', missing_evidence: [], constraints: ['read only'], pressure_points: ['boundary'], findings: ['finding'], recommendation: 'stop', artifacts: [createSharedInput],
  });
  const createVisionary = smokeArtifact(createArchitecture, 'proposal_visionary_position', 'create-architecture-visionary-position');
  const createPragmatist = smokeArtifact(createArchitecture, 'proposal_pragmatist_position', 'create-architecture-pragmatist-position');
  applyFanoutBranches(createArchitecture, {
    proposal_visionary_position: { outcome: 'ready_for_freeze', logical_position: 'visionary', position_kind: 'thesis', summary: 'A', evidence_refs: ['audit'], fingerprint: architectureFingerprint('A'), artifacts: [createVisionary] },
    proposal_pragmatist_position: { outcome: 'ready_for_freeze', logical_position: 'pragmatist', position_kind: 'antithesis', summary: 'B', evidence_refs: ['audit'], fingerprint: architectureFingerprint('B'), artifacts: [createPragmatist] },
  });
  applySmokeOutput(createArchitecture, {
    outcome: 'frozen', shared_input_artifact: createSharedInput,
    positions: [
      { logical_position: 'visionary', artifact: createVisionary, fingerprint: architectureFingerprint('A'), accepted_output_step_id: 'proposal_visionary_position' },
      { logical_position: 'pragmatist', artifact: createPragmatist, fingerprint: architectureFingerprint('B'), accepted_output_step_id: 'proposal_pragmatist_position' },
    ],
  });
  const createVisionarySynthesis = smokeArtifact(createArchitecture, 'proposal_visionary_synthesis', 'create-architecture-visionary-synthesis');
  const createPragmatistSynthesis = smokeArtifact(createArchitecture, 'proposal_pragmatist_synthesis', 'create-architecture-pragmatist-synthesis');
  applyFanoutBranches(createArchitecture, {
    proposal_visionary_synthesis: { outcome: 'ready_for_comparison', logical_position: 'visionary', summary: 'A synthesis', source_position_artifact_ids: [createVisionary.id, createPragmatist.id], evidence_refs: ['both'], fingerprint: architectureFingerprint('A'), artifacts: [createVisionarySynthesis] },
    proposal_pragmatist_synthesis: { outcome: 'ready_for_comparison', logical_position: 'pragmatist', summary: 'B synthesis', source_position_artifact_ids: [createVisionary.id, createPragmatist.id], evidence_refs: ['both'], fingerprint: architectureFingerprint('B'), artifacts: [createPragmatistSynthesis] },
  });
  applySmokeOutput(createArchitecture, { outcome: 'diverged', summary: 'material divergence', dimension_results: [{ dimension: 'boundaries', aligned: false, evidence: 'different' }], material_divergences: ['boundaries'], next_step: 'proposal_dialectic_adjudication' });
  const createLineage = { position_artifact_ids: [createVisionary.id, createPragmatist.id], synthesis_artifact_ids: [createVisionarySynthesis.id, createPragmatistSynthesis.id], selected_candidate: 'visionary' };
  applySmokeOutput(createArchitecture, { outcome: 'adjudicated', resolution: 'select_visionary', summary: 'select A', decision_basis: 'evidence', canonical_lineage: createLineage, synthesis_artifact_ids: createLineage.synthesis_artifact_ids, evidence_refs: ['audit'], next_step: 'architecture_proposal' });
  const proposal = smokeArtifact(createArchitecture, 'architecture_proposal', 'architecture-proposal');
  applySmokeOutput(createArchitecture, {
    outcome: 'ready_for_review', summary: 'proposal', selected_direction: 'A', mode: 'audit', architecture_generation_mode: 'dialectic',
    dialectic_lineage: { ...createLineage, convergence_outcome: 'diverged', adjudication_id: 'proposal_dialectic_adjudication', canonical_logical_owner: 'create_architecture_owner' },
    artifact_scope: ['proposal only'], implementation_scope: 'proposal_only', next_step: 'done', artifacts: [proposal],
  });
  applySmokeOutput(createArchitecture, cleanArchitectReview());
  applySmokeOutput(createArchitecture, cleanCriticReview());
  applySmokeOutput(createArchitecture, { outcome: 'ready_for_approval', summary: 'ready', unresolved_findings: [] });
  applySmokeOutput(createArchitecture, { approval: 'approved' });
  assert.equal(createArchitecture.baton.status, 'done');
  assert.equal(createArchitecture.cursors.includes('architecture_implementation'), false);
  assert.equal(createArchitecture.cursors.filter((cursor) => cursor === 'proposal_dialectic_adjudication').length, 1);

  const hegel = smokeContext('hegel');
  const brief = smokeArtifact(hegel, 'diagnostic_intake', 'hegel-diagnostic-brief');
  applySmokeOutput(hegel, { outcome: 'ready_for_positions', topic: 'fixture', diagnostic_question: 'Which model fits?', known_constraints: ['read only'], evidence_requirements: ['local evidence'], source_requirements: ['repository'], stopping_budget: { dialectic_cycles: 1, max_adjudications: 1, max_hostile_reviews: 2 }, mutation_policy: 'read_only', artifacts: [brief] });
  const hegelVisionary = smokeArtifact(hegel, 'diagnostic_visionary_position', 'hegel-visionary-position');
  const hegelPragmatist = smokeArtifact(hegel, 'diagnostic_pragmatist_position', 'hegel-pragmatist-position');
  applyFanoutBranches(hegel, {
    diagnostic_visionary_position: { outcome: 'ready_for_freeze', logical_position: 'visionary', position_kind: 'thesis', summary: 'A', evidence_refs: ['repo'], fingerprint: diagnosticFingerprint('A'), artifacts: [hegelVisionary] },
    diagnostic_pragmatist_position: { outcome: 'ready_for_freeze', logical_position: 'pragmatist', position_kind: 'antithesis', summary: 'B', evidence_refs: ['repo'], fingerprint: diagnosticFingerprint('B'), artifacts: [hegelPragmatist] },
  });
  applySmokeOutput(hegel, { outcome: 'frozen', shared_input_artifact: brief, positions: [
    { logical_position: 'visionary', artifact: hegelVisionary, fingerprint: diagnosticFingerprint('A'), accepted_output_step_id: 'diagnostic_visionary_position' },
    { logical_position: 'pragmatist', artifact: hegelPragmatist, fingerprint: diagnosticFingerprint('B'), accepted_output_step_id: 'diagnostic_pragmatist_position' },
  ] });
  const hegelVisionarySynthesis = smokeArtifact(hegel, 'diagnostic_visionary_synthesis', 'hegel-visionary-synthesis');
  const hegelPragmatistSynthesis = smokeArtifact(hegel, 'diagnostic_pragmatist_synthesis', 'hegel-pragmatist-synthesis');
  applyFanoutBranches(hegel, {
    diagnostic_visionary_synthesis: { outcome: 'ready_for_comparison', logical_position: 'visionary', summary: 'A synthesis', source_position_artifact_ids: [hegelVisionary.id, hegelPragmatist.id], evidence_refs: ['both'], fingerprint: diagnosticFingerprint('A'), artifacts: [hegelVisionarySynthesis] },
    diagnostic_pragmatist_synthesis: { outcome: 'ready_for_comparison', logical_position: 'pragmatist', summary: 'B synthesis', source_position_artifact_ids: [hegelVisionary.id, hegelPragmatist.id], evidence_refs: ['both'], fingerprint: diagnosticFingerprint('B'), artifacts: [hegelPragmatistSynthesis] },
  });
  applySmokeOutput(hegel, { outcome: 'diverged', summary: 'models diverge', dimension_results: [{ dimension: 'causal_model', aligned: false, evidence: 'different' }], material_divergences: ['causal model'], next_step: 'diagnostic_adjudication' });
  applySmokeOutput(hegel, { outcome: 'unresolved_with_evidence', resolution: 'reject_both', summary: 'reject both', unresolved_reasons: ['both unsupported'], synthesis_artifact_ids: [hegelVisionarySynthesis.id, hegelPragmatistSynthesis.id], evidence_refs: ['repo'], next_step: 'diagnostic_report' });
  const diagnosticReport = smokeArtifact(hegel, 'diagnostic_report', 'diagnostic-report');
  const reportOutput = { outcome: 'unresolved_with_evidence', summary: 'unresolved', facts: ['fact'], inferences: [], unresolved_contradictions: ['contradiction'], rejected_models: ['A', 'B'], canonical_synthesis: null, unresolved_reason: 'reject both', confidence: { level: 'low', rationale: 'insufficient support' }, cheapest_falsifying_next_experiment: 'collect discriminating evidence', dialectic_lineage: { position_artifact_ids: [hegelVisionary.id, hegelPragmatist.id], synthesis_artifact_ids: [hegelVisionarySynthesis.id, hegelPragmatistSynthesis.id], convergence_outcome: 'diverged', adjudication_id: 'diagnostic_adjudication', resolution: 'reject_both', canonical_logical_owner: 'hegel_diagnostic_owner' }, artifacts: [diagnosticReport] };
  const hostileFinding = { category: 'source_support', severity: 'must_fix', evidence: 'gap', action: 'preserve unresolved' };
  applySmokeOutput(hegel, reportOutput);
  applySmokeOutput(hegel, { outcome: 'needs_revision', summary: 'revise', checked_evidence: ['report'], findings: [hostileFinding], next_step: 'diagnostic_report' });
  applySmokeOutput(hegel, reportOutput);
  applySmokeOutput(hegel, { outcome: 'needs_revision', summary: 'still unresolved', checked_evidence: ['report'], findings: [hostileFinding], next_step: 'diagnostic_report' });
  assert.equal(hegel.baton.cursor, 'diagnostic_review_exit');
  applySmokeOutput(hegel, { outcome: 'review_exhausted', final_classification: 'unresolved_with_evidence', summary: 'bounded review exhausted', latest_diagnostic_report: diagnosticReport, latest_hostile_findings: [hostileFinding], review_iteration_count: 2, next_step: 'done' });
  assert.equal(hegel.baton.status, 'done');
  assert.equal(hegel.cursors.filter((cursor) => cursor === 'diagnostic_adjudication').length, 1);
  assert.equal(hegel.cursors.filter((cursor) => cursor === 'diagnostic_hostile_review').length, 2);
  assert.equal(hegel.cursors.includes('diagnostic_review_exit'), true);
});

test('dialectic attribution stays precise and repository-specific naming is not attributed to the source', () => {
  const docs = [
    readFileSync(path.join(root, 'shared/dialectic/README.md'), 'utf8'),
    readFileSync(path.join(root, 'workflows/hegel/README.md'), 'utf8'),
  ].join('\n');
  assert.match(docs, /https:\/\/whitepaper\.soulmates\.md\/#4-soul-architecture-designing-agentic-soulmates/);
  assert.match(docs, /Visionary/);
  assert.match(docs, /Pragmatist/);
  for (const forbidden of ["Hegel's first law", 'first law of dialectics', 'rule of three']) assert.doesNotMatch(docs, new RegExp(forbidden, 'i'));
});
