import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'bun:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkflowDocument } from '../persistence/workflow-resources/workflow-document-reader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const workflowNames = [
  'red-green-refactor',
  'pair-programming',
  'review-fix-verify',
  'make-it-fast',
  'deep-debugging',
];

function workflow(name) {
  return readWorkflowDocument(path.join(root, 'workflows', name, 'workflow.toml'));
}

function prompt(step) {
  return Array.isArray(step.input?.prompt) ? step.input.prompt.join('\n') : (step.input?.prompt ?? '');
}

test('focused engineering workflows are catalogued runnable packages with independent logical workers', () => {
  const catalog = readFileSync(path.join(root, 'README.md'), 'utf8');
  for (const name of workflowNames) {
    const doc = workflow(name);
    assert.equal(doc.name, name);
    assert.equal(doc.start in doc.steps, true);
    assert.equal(doc.done in doc.steps, true);
    assert.match(catalog, new RegExp(`workflows/${name}`));

    const agentIds = Object.values(doc.steps).flatMap((step) => [
      step.agent,
      ...Object.values(step.branches ?? {}).map((branch) => branch.agent),
    ]).filter(Boolean);
    assert.equal(new Set(agentIds).size, agentIds.length, `${name} reuses a logical agent id`);
  }
});

test('red-green-refactor preserves one-driver TDD evidence and bounded independent review', () => {
  const doc = workflow('red-green-refactor');
  assert.deepEqual(doc.loopPolicies.review_rework, {
    steps: ['cycle', 'review'], entry: 'cycle', boundary: 'review', maxIterations: 2, onLimit: 'done',
  });
  assert.match(prompt(doc.steps.cycle), /RED:/);
  assert.match(prompt(doc.steps.cycle), /GREEN:/);
  assert.match(prompt(doc.steps.cycle), /REFACTOR:/);
  assert.match(prompt(doc.steps.cycle), /FAST:/);
  assert.notEqual(doc.steps.cycle.agent, doc.steps.review.agent);
});

test('pair-programming permits parallel tracks only behind explicit write ownership', () => {
  const doc = workflow('pair-programming');
  assert.equal(doc.steps.pair.kind, 'fanout');
  assert.equal(doc.steps.pair.max_parallel, 2);
  assert.deepEqual(doc.steps.pair.input.branches, ['driver', 'navigator']);
  assert.equal(doc.steps.pair.branches.driver.agent, 'pair_driver');
  assert.equal(doc.steps.pair.branches.navigator.agent, 'pair_navigator');
  assert.match(prompt(doc.steps.intake), /Never permit concurrent writes to the same path/);
  assert.match(prompt(doc.steps.intake), /runner does not provision isolated workspaces/);
  assert.doesNotMatch(prompt(doc.steps.pair.branches.driver), /isolated_workspaces/);
  assert.doesNotMatch(prompt(doc.steps.pair.branches.navigator), /isolated_workspaces/);
  assert.match(prompt(doc.steps.pair.branches.navigator), /shared_zone mode remain read-only/);
  const intakeSchema = JSON.parse(readFileSync(path.join(root, 'workflows/pair-programming/schemas/intake-output.json'), 'utf8'));
  assert.deepEqual(intakeSchema.properties.mode.enum, ['disjoint_zones', 'shared_zone']);
  const trackSchema = JSON.parse(readFileSync(path.join(root, 'workflows/pair-programming/schemas/track-output.json'), 'utf8'));
  assert.deepEqual(trackSchema.properties.candidate_kind.enum, ['implementation', 'read_only_guidance']);
  assert.notEqual(doc.steps.integration.agent, doc.steps.review.agent);
});

test('review-fix-verify keeps dispositions traceable and external transport out of scope', () => {
  const doc = workflow('review-fix-verify');
  assert.deepEqual(doc.loopPolicies.triage_fix_recheck, {
    steps: ['triage', 'fix', 'verify'], entry: 'triage', boundary: 'verify', maxIterations: 2, onLimit: 'done',
  });
  assert.match(prompt(doc.steps.triage), /rejected_with_evidence/);
  assert.match(prompt(doc.steps.fix), /Do not publish, comment, or resolve external review threads/);
  assert.equal(doc.steps.verify.next.cases.triage, 'triage');
  assert.match(prompt(doc.steps.verify), /Never send a triage defect directly to the fixer/);
  assert.notEqual(doc.steps.fix.agent, doc.steps.verify.agent);
});

test('make-it-fast freezes the metric contract before profile-guided implementation', () => {
  const doc = workflow('make-it-fast');
  assert.match(prompt(doc.steps.intake), /exact workload, primary metric/);
  assert.match(prompt(doc.steps.implement), /do not change the workload, metric, threshold/);
  assert.match(prompt(doc.steps.compare), /exact baseline workload and measurement method/);
  assert.notEqual(doc.steps.implement.agent, doc.steps.compare.agent);
});

test('deep-debugging has bounded convergence, one hostile reset, and honest terminal states', () => {
  const doc = workflow('deep-debugging');
  assert.deepEqual(doc.loopPolicies.pre_reset_diagnosis, {
    steps: ['experiment', 'evidence_judgment'], entry: 'experiment', boundary: 'evidence_judgment', maxIterations: 3, onLimit: 'hostile_reset',
  });
  assert.deepEqual(doc.loopPolicies.post_reset_diagnosis, {
    steps: ['post_reset_experiment', 'post_reset_judgment'], entry: 'post_reset_experiment', boundary: 'post_reset_judgment', maxIterations: 2, onLimit: 'cleanup',
  });
  assert.equal(doc.steps.hostile_reset.kind, 'fanout');
  assert.deepEqual(doc.steps.hostile_reset.input.branches, ['hostile_critic', 'external_research']);
  assert.equal(doc.steps.hostile_reset.branches.hostile_critic.agent, 'deep_hostile_critic');
  assert.equal(doc.steps.hostile_reset.branches.external_research.agent, 'deep_external_researcher');
  assert.equal(Object.values(doc.steps).filter((step) => step.name === 'Hostile reset').length, 1);
  assert.notEqual(doc.steps.experiment.agent, doc.steps.evidence_judgment.agent);
  assert.notEqual(doc.steps.post_reset_experiment.agent, doc.steps.post_reset_judgment.agent);
  assert.match(prompt(doc.steps.experiment), /fingerprint is the tuple/);
  assert.match(prompt(doc.steps.evidence_judgment), /Two consecutive no-information results or three total pre-reset rounds require hostile_reset/);
  assert.match(prompt(doc.steps.fix_and_verify), /use a non-blocking stop with source_step_id = fix_and_verify/);
  assert.match(prompt(doc.steps.fix_and_verify), /explicitly declines or defers that reproduction/);
  assert.match(prompt(doc.steps.cleanup), /merely waiting for user input must remain a non-blocking stop/);

  const hostileResetSchema = JSON.parse(readFileSync(path.join(root, 'workflows/deep-debugging/schemas/hostile-reset-output.json'), 'utf8'));
  assert.equal(hostileResetSchema.properties.candidate_discriminators.minItems, undefined);
  assert.match(prompt(doc.steps.hostile_reset), /empty candidate list is valid/);

  const cleanupSchema = readFileSync(path.join(root, 'workflows/deep-debugging/schemas/cleanup-output.json'), 'utf8');
  for (const state of ['fixed', 'mitigated_not_explained', 'locally_verified_pending_user_repro', 'not_reproduced', 'unresolved_with_evidence']) {
    assert.match(cleanupSchema, new RegExp(state));
  }
});
