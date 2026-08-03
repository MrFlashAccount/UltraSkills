import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { resolveRunPaths } from '../../persistence/run-state/paths.mjs';
import { continueRun, next, registerWorkflowRun, writeOutput } from '../helpers/orbita-production-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const tempDir = mkdtempSync(path.join(tmpdir(), 'focused-workflow-smoke-'));
const runsRoot = path.join(tempDir, 'runs');
let sequence = 0;

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

const strings = ['evidence'];
const fingerprint = { component_or_boundary: 'boundary', mechanism: 'mechanism', observable: 'signal', edit_surface: ['target.js'] };
const hypothesis = {
  id: 'H1', claim: 'causal claim', component_or_boundary: 'boundary', mechanism: 'mechanism', observable: 'signal',
  edit_surface: ['target.js'], evidence_for: ['symptom'], evidence_against: [], true_signal: 'signal present',
  false_signal: 'signal absent', minimal_experiment: 'run focused reproduction', instrumentation_risk: 'low and reversible',
};

function logicalStep(id) {
  const parts = id.split('__');
  return parts.length >= 4 && parts[1] === 'fanout' ? parts.at(-1) : id;
}

function outputFor(workflowName, id, calls, variant) {
  const step = logicalStep(id);
  const n = (calls.get(step) ?? 0) + 1;
  calls.set(step, n);

  if (workflowName === 'red-green-refactor') {
    if (step === 'intake') return { outcome: 'ready', behavior_contract: 'new behavior', test_oracle: 'focused assertion', test_location: 'target.test.js', verification_command: 'bun test target.test.js', out_of_scope: [] };
    if (step === 'cycle') return { outcome: 'ready_for_review', summary: 'implemented', red: { action: 'added focused test', evidence: ['failed for intended assertion'] }, green: { action: 'minimal fix', evidence: ['same test passed'] }, refactor: { status: 'skipped', reason: 'no structural debt', evidence: [] }, fast: { status: 'skipped', reason: 'not requested', evidence: [] }, changed_files: ['target.js', 'target.test.js'], verification: [{ command: 'bun test target.test.js', result: 'passed' }], remaining_risks: [] };
    if (step === 'review') return { outcome: 'passed', next: 'done', summary: 'evidence complete', evidence_checked: strings, findings: [] };
  }

  if (workflowName === 'pair-programming') {
    if (step === 'intake') return { outcome: 'ready', mode: 'shared_zone', driver_scope: ['target.js'], navigator_scope: ['read-only review'], integration_owner: 'pair_integrator', success_checks: ['focused test passes'], forbidden_overlaps: ['navigator writes target.js'] };
    if (step === 'driver') return { outcome: 'ready_for_integration', track: 'driver', candidate_kind: 'implementation', summary: 'driver change', evidence: strings, changed_files: ['target.js'], verification: ['focused test passed'], decisions: ['minimal change'], disagreements: [] };
    if (step === 'navigator') return { outcome: 'ready_for_integration', track: 'navigator', candidate_kind: 'read_only_guidance', summary: 'navigator review', evidence: strings, changed_files: [], verification: [], decisions: ['edge case covered'], disagreements: [] };
    if (step === 'pair') return { outcome: 'ready_for_integration', summary: 'tracks joined', evidence: strings, changed_files: ['target.js'], verification: ['focused test passed'], conflicts: [], resolutions: [], remaining_risks: [] };
    if (step === 'integration') return { outcome: 'ready_for_review', summary: 'integrated', evidence: strings, changed_files: ['target.js'], verification: ['focused test passed'], conflicts: [], resolutions: [], remaining_risks: [] };
    if (step === 'review') return { outcome: 'passed', next: 'done', summary: 'ownership and result verified', evidence_checked: strings, findings: [] };
  }

  if (workflowName === 'review-fix-verify') {
    if (step === 'intake') return { outcome: 'ready', findings: [{ id: 'F1', source: 'review', severity: 'must_fix', problem: 'wrong behavior', location: 'target.js', requested_action: 'correct it', evidence: strings }] };
    if (step === 'triage') return { outcome: 'ready_for_fix', dispositions: [{ id: 'F1', disposition: 'accepted', reason: 'confirmed', evidence: strings, owner: 'findings_fixer', edit_surface: ['target.js'], acceptance_check: 'focused test' }], implementation_order: ['F1'] };
    if (step === 'fix') return { outcome: 'ready_for_verify', summary: 'finding fixed', finding_changes: [{ id: 'F1', status: 'fixed', evidence: strings }], changed_files: ['target.js'], verification: ['focused test passed'], remaining_risks: [] };
    if (step === 'verify') return { outcome: 'passed', next: 'done', summary: 'finding closed', finding_results: [{ id: 'F1', closed: true, evidence: 'diff and test' }], evidence_checked: strings, findings: [] };
  }

  if (workflowName === 'make-it-fast') {
    if (step === 'intake') return { outcome: 'ready', workload: 'fixed workload', primary_metric: 'latency ms', correctness_guard: 'result equality', measurement_method: 'five identical samples', environment_controls: ['same host'], sample_policy: 'warm then five samples', success_threshold: 'at least 10 percent', edit_boundary: ['target.js'], stop_conditions: ['correctness regression'] };
    if (step === 'baseline') return { outcome: 'ready_for_hypothesis', valid: true, method: 'five identical samples', environment: ['same host'], raw_samples: [100, 101, 99], aggregate: '100 ms median', correctness: 'passed', profile_evidence: ['hot function owns 70 percent'], dominant_cost: 'repeated parsing' };
    if (step === 'hypothesis') return { outcome: 'ready_for_implementation', mechanism: 'remove repeated parsing', target: 'hot function', expected_metric_movement: 'latency down', edit_surface: ['target.js'], correctness_risks: ['cache invalidation'], falsifier: 'threshold not met', rollback: 'revert cache' };
    if (step === 'implement') return { outcome: 'ready_for_comparison', summary: 'cached parsed value', mechanism_implemented: 'remove repeated parsing', changed_files: ['target.js'], correctness_checks: ['result equality passed'], remaining_risks: [] };
    if (step === 'compare') return { outcome: 'improved', valid: true, method: 'five identical samples', environment_parity: 'same host and workload', raw_samples: [78, 80, 79], aggregate: '79 ms median', baseline_aggregate: '100 ms median', delta: '-21 percent', threshold_met: true, correctness: 'passed', variance_notes: [] };
    if (step === 'review') return { outcome: 'passed', next: 'done', summary: 'comparable improvement', evidence_checked: strings, findings: [] };
  }

  if (workflowName === 'deep-debugging') {
    if (step === 'intake') return { outcome: 'ready', symptom: 'request fails', expected_behavior: 'request succeeds', reproduction: ['run focused repro'], environment: ['test env'], frequency: 'always', change_window: null, affected_boundaries: ['client-service'], instrumentation_constraints: ['no secrets'], cleanup_obligations: ['remove debug log'], fixed_evidence: ['same repro passes'] };
    if (step === 'static_diagnosis' && variant === 'fixed') return { outcome: 'exact_cause', next: 'fix_and_verify', summary: 'exact causal chain', symptom: 'request fails', mechanism: 'wrong branch condition', systemic_cause: 'missing regression guard', evidence: strings, remaining_hypotheses: [] };
    if (step === 'static_diagnosis') return { outcome: 'needs_experiment', next: 'experiment', summary: 'two mechanisms remain', symptom: 'request fails', mechanism: null, systemic_cause: null, evidence: strings, remaining_hypotheses: ['H1', 'H2'] };
    if (step === 'experiment' || step === 'post_reset_experiment') return { outcome: 'ready_for_judgment', phase: step === 'experiment' ? 'pre_reset' : 'post_reset', attempt_number: n, hypothesis: { ...hypothesis, id: `${step}-${n}` }, fingerprint: { ...fingerprint, observable: `${step}-signal-${n}` }, instrumentation: ['temporary debug log'], reproduction_evidence: strings, observed_result: 'no_information', debugger_information_gain_claimed: false, attempt_ledger: [{ attempt_number: n, hypothesis_id: `${step}-${n}`, fingerprint: { ...fingerprint, observable: `${step}-signal-${n}` }, observed_result: 'no_information' }], cleanup_inventory: ['temporary debug log'] };
    if (step === 'evidence_judgment') {
      if (n === 1) return { outcome: 'continue', next: 'experiment', summary: 'redesign required', accepted_evidence: strings, information_gain: false, duplicate_fingerprint: false, total_rounds: 1, consecutive_no_information: 1, reason: 'no information' };
      return { outcome: 'hostile_reset', next: 'hostile_reset', summary: 'anti-loop threshold reached', accepted_evidence: strings, information_gain: false, duplicate_fingerprint: false, total_rounds: 2, consecutive_no_information: 2, reason: 'two no-information rounds' };
    }
    if (step === 'hostile_critic') return { outcome: 'ready_for_reframe', branch: 'hostile_critic', summary: 'anchoring found', invalidated_assumptions: ['wrong layer'], evidence: strings, sources: [], candidate_discriminators: ['new boundary probe'], limitations: [] };
    if (step === 'external_research') return { outcome: 'ready_for_reframe', branch: 'external_research', summary: 'analogue found', invalidated_assumptions: [], evidence: strings, sources: ['https://example.com/primary'], candidate_discriminators: ['new signature probe'], limitations: [] };
    if (step === 'hostile_reset') return { outcome: 'ready_for_reframe', summary: 'fresh evidence joined', invalidated_assumptions: ['wrong layer'], contradictions: [], source_quality: ['primary analogue only'], candidate_discriminators: ['new boundary probe'], web_status: 'used' };
    if (step === 'reframe') return { outcome: 'ready_for_post_reset', next: 'post_reset_experiment', summary: 'fresh plan', discarded_assumptions: ['wrong layer'], experiments: [{ order: 1, hypothesis: 'new cause', fingerprint: 'new-boundary/new-mechanism/new-signal/new-edit', true_signal: 'present', false_signal: 'absent', expected_information_gain: 'separates layers', cost: 'low', novelty: 'new boundary' }] };
    if (step === 'post_reset_judgment') return { outcome: 'unresolved_with_evidence', next: 'cleanup', summary: 'bounded exit', accepted_evidence: strings, information_gain: false, post_reset_rounds: 1, remaining_distinct_experiments: 0, reason: 'no discriminator remains' };
    if (step === 'fix_and_verify') return { outcome: 'ready_for_review', summary: 'root cause fixed', confirmed_mechanism: 'wrong branch condition', fix: 'correct condition', changed_files: ['target.js', 'target.test.js'], pre_fix_symptom: ['focused repro failed'], same_repro_post_fix: ['focused repro passed'], regressions: ['test suite passed'], regression_guard: 'focused regression test', instrumentation_cleanup: ['debug log removed'], remaining_risks: [] };
    if (step === 'final_review') return { outcome: 'passed', next: 'cleanup', summary: 'causal fix verified', evidence_checked: strings, causal_chain_confirmed: true, same_repro_clear: true, regressions_passed: true, instrumentation_clean: true, findings: [] };
    if (step === 'cleanup') return { outcome: 'complete', terminal_state: variant === 'fixed' ? 'fixed' : 'unresolved_with_evidence', summary: 'clean terminal state', cleanup_evidence: ['temporary instrumentation absent'], attempt_ledger: variant === 'fixed' ? [] : ['two pre-reset and one post-reset experiment'], confirmed_mechanisms: variant === 'fixed' ? ['wrong branch condition'] : [], falsified_hypotheses: [], remaining_uncertainty: variant === 'fixed' ? [] : ['root cause unknown'], next_action: variant === 'fixed' ? 'none' : 'collect new boundary evidence', final_review_status: variant === 'fixed' ? 'passed' : 'not_run' };
  }

  throw new Error(`no smoke output for ${workflowName}:${id}`);
}

async function smoke(workflowName, variant = 'happy') {
  sequence += 1;
  const runId = `focused-smoke-${process.pid}-${sequence}-${workflowName}`;
  const workflowPath = path.join(root, 'workflows', workflowName, 'workflow.toml');
  const registered = await registerWorkflowRun({ runId, workflowPath, runsRoot, claim: true });
  const leaseToken = registered.leaseToken;
  const calls = new Map();
  let response = await next({ runId, workflowPath, runsRoot, leaseToken, userPrompt: `smoke ${workflowName}` });

  for (let guard = 0; guard < 30 && response.status !== 'done'; guard += 1) {
    assert.equal(response.status, 'needs_host_actions', JSON.stringify(response));
    assert.ok(response.requests.length > 0);
    for (const request of response.requests) {
      const stepId = request.stepId ?? request.id;
      const json = JSON.stringify(outputFor(workflowName, request.id, calls, variant));
      let debugSummaryFile;
      if (request.action === 'run_worker') {
        const runDir = resolveRunPaths({ runId, runsRoot }).runDir;
        debugSummaryFile = path.join(runDir, stepId, 'debug-summary.md');
        mkdirSync(path.dirname(debugSummaryFile), { recursive: true });
        writeFileSync(debugSummaryFile, `smoke output for ${stepId}\n`);
      }
      const written = await writeOutput({ runId, workflowPath, runsRoot, leaseToken, stepId, json, debugSummaryFile });
      assert.equal(written.accepted, true);
    }
    response = await continueRun({ runId, workflowPath, runsRoot, leaseToken });
  }

  assert.equal(response.status, 'done', JSON.stringify(response));
  assert.equal(response.baton.cursor, 'done');
  return response;
}

for (const workflowName of ['red-green-refactor', 'pair-programming', 'review-fix-verify', 'make-it-fast']) {
  test(`focused workflow smoke: ${workflowName} reaches done through public runner APIs`, async () => {
    await smoke(workflowName);
  });
}

test('focused workflow smoke: deep-debugging fixed fast path requires final review and cleanup', async () => {
  const response = await smoke('deep-debugging', 'fixed');
  assert.equal(response.baton.state.cleanup.terminal_state, 'fixed');
  assert.equal(response.baton.state.cleanup.final_review_status, 'passed');
});

test('focused workflow smoke: deep-debugging no-information path performs one hostile reset and exits honestly', async () => {
  const response = await smoke('deep-debugging', 'hostile');
  assert.equal(response.baton.state.cleanup.terminal_state, 'unresolved_with_evidence');
  assert.equal(response.baton.state.$loopProgress.pre_reset_diagnosis, 2);
  assert.equal(response.baton.state.$loopProgress.post_reset_diagnosis, 1);
  assert.ok(response.baton.state.hostile_reset);
});
