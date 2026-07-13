import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'bun:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkflowDocument } from '../persistence/workflow-resources/workflow-document-reader.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const workflowDoc = readWorkflowDocument(path.join(REPO_ROOT, 'workflows/dev-harness/workflow.toml'));

function promptText(step) {
  const prompt = step.input?.prompt ?? '';
  return Array.isArray(prompt) ? prompt.join('\n') : prompt;
}

test('dev-harness uses implementation and review as the only fanout owners', () => {
  assert.equal(workflowDoc.steps.implementation.kind, 'fanout');
  assert.deepEqual(workflowDoc.steps.implementation.input.branches.first_of, [
    '${{ input.review.implementation_branches }}',
    '${{ input.planning_draft.selected_implementation_steps }}',
  ]);
  assert.deepEqual(Object.keys(workflowDoc.steps.implementation.branches), [
    'backend_implementation',
    'frontend_implementation',
    'architecture_artifact_update',
  ]);
  assert.equal(workflowDoc.steps.review.kind, 'fanout');
  assert.equal(workflowDoc.steps.review.input.branches, '${{ input.implementation.review_branches }}');
  assert.deepEqual(Object.keys(workflowDoc.steps.review.branches), [
    'architect_review',
    'backend_review',
    'frontend_review',
    'frontend_taste_review',
    'security_review',
    'privacy_review',
    'qa_review',
  ]);
  for (const retiredStepId of ['implementation_dispatch', 'implementation_join', 'review_dispatch', 'review_join']) {
    assert.equal(Object.hasOwn(workflowDoc.steps, retiredStepId), false);
  }
});

test('dev-harness implementation branches consume only their owner-written rework handoff', () => {
  const handoffByBranch = {
    backend_implementation: 'input.review.implementer_handoffs.backend_implementation',
    frontend_implementation: 'input.review.implementer_handoffs.frontend_implementation',
    architecture_artifact_update: 'input.review.implementer_handoffs.architecture_artifact_update',
  };
  const rawReviewerInput = /\$\{\{ input\.(?:architect_review|backend_review|frontend_review|frontend_taste_review|security_review|privacy_review|qa_review)\b/;

  for (const [branchId, handoffPath] of Object.entries(handoffByBranch)) {
    const text = promptText(workflowDoc.steps.implementation.branches[branchId]);
    assert.match(text, new RegExp(handoffPath.replaceAll('.', '\\.')));
    assert.match(text, /first implementation pass/);
    assert.doesNotMatch(text, rawReviewerInput);
  }
});

test('issue 197: dev-harness implementation instructions and schema align on self-caused red-test semantics', () => {
  for (const stepId of ['backend_implementation', 'frontend_implementation']) {
    const text = promptText(workflowDoc.steps.implementation.branches[stepId]);
    assert.match(text, /red tests, lint failures, typecheck failures/);
    assert.match(text, /own in-scope .* changes as implementation work to fix and rerun, not as blockers by themselves/);
    assert.match(text, /missing external input, permission, an approved-contract change, a redesign\/plan decision/);
  }

  const schemaText = readFileSync(path.join(REPO_ROOT, 'workflows/dev-harness/schemas/implementation-output.json'), 'utf8');
  assert.match(schemaText, /own in-scope changes are implementation work to fix and rerun/);
  assert.match(schemaText, /external or contract-level missing help through the runner non-blocking stop control channel/);
  assert.doesNotMatch(schemaText, /failed checks as blockers by themselves|red tests.*blockers by themselves/);

  const testingReference = readFileSync(path.join(REPO_ROOT, 'skills/implementation-harness/references/testing.md'), 'utf8');
  const outputContractReference = readFileSync(path.join(REPO_ROOT, 'skills/implementation-harness/references/output-contract.md'), 'utf8');
  assert.match(testingReference, /own in-scope implementation changes as work to fix and rerun/);
  assert.match(outputContractReference, /Red tests caused by your own in-scope changes are implementation work to fix and rerun/);
});

test('issue 197: Orbita host watchdog instructions split bootstrap silence from active progress evidence', () => {
  const skillText = readFileSync(path.join(REPO_ROOT, 'skills/orbita/SKILL.md'), 'utf8');
  assert.match(skillText, /bootstrap\/instruction-load silence separately from active implementation progress/);
  assert.match(skillText, /current work, inspected or changed surfaces, verification state, and the next bounded checkpoint/);
  assert.match(skillText, /continue that same worker and ask for the next bounded checkpoint/);
  assert.match(skillText, /Do not persist progress in baton, scrape transcripts, read private runner state, or add durable worker status storage/);
  assert.match(skillText, /For `wait_agent`, set `timeout_ms` to at least `1800000` to cover the 30-minute watchdog/);
  assert.match(skillText, /Allow 30 minutes for load\/progress/);
  assert.match(skillText, /same 30\+2-minute bound/);
  assert.doesNotMatch(skillText, /Allow 10 minutes|same 10\+2-minute bound/);
});

test('Orbita skill invokes bundled CLI entrypoints from the resolved skill root', () => {
  const skillText = readFileSync(path.join(REPO_ROOT, 'skills/orbita/SKILL.md'), 'utf8');
  assert.match(skillText, /set `ORBITA_SKILL_ROOT` to the directory containing this `SKILL\.md`/);
  assert.match(skillText, /\$ORBITA_SKILL_ROOT\/lib\/entrypoints\/cli\/workflow-catalog\.mjs/);
  assert.match(skillText, /\$ORBITA_SKILL_ROOT\/lib\/entrypoints\/cli\/workflow-runs\.mjs/);
  assert.match(skillText, /\$ORBITA_SKILL_ROOT\/lib\/entrypoints\/cli\/workflow-runner\.mjs/);
  assert.doesNotMatch(skillText, /bun \.\/lib\/entrypoints\/cli\//);
});

test('Orbita skill stops on lease conflicts and offers only an approved forced takeover', () => {
  const skillText = readFileSync(path.join(REPO_ROOT, 'skills/orbita/SKILL.md'), 'utf8');
  assert.match(skillText, /If claim reports `occupied` or `stale`, stop/);
  assert.match(skillText, /rerunning\s+that exact claim command with `--takeover`/);
  assert.match(skillText, /never force takeover without user\s+approval/);
  assert.match(skillText, /takeover invalidates\s+the previous holder's token/);
});

test('Orbita skill explains direct rollback to state-bearing workflow predecessors', () => {
  const skillText = readFileSync(path.join(REPO_ROOT, 'skills/orbita/SKILL.md'), 'utf8');
  assert.match(skillText, /every valid predecessor present in `baton\.state`/);
  assert.match(skillText, /never derives navigation from debug history or offers downstream steps/);
  assert.match(skillText, /target matching the request and move once/);
  assert.match(skillText, /preserves baton state without extra acknowledgement/);
  assert.doesNotMatch(skillText, /acknowledge-retained-state/);
});

test('Orbita skill stays bounded and delegates dynamic request protocol to runner stdout', () => {
  const skillText = readFileSync(path.join(REPO_ROOT, 'skills/orbita/SKILL.md'), 'utf8');
  assert.ok(Buffer.byteLength(skillText) <= 9_000, 'Orbita SKILL.md exceeded the 9 KB always-loaded budget');
  assert.match(skillText, /stdout is the sole active directive/);
  assert.match(skillText, /already supplies current actions, dynamic commands, schemas, bindings, approval text, continuation, and terminal JSON/);
  assert.doesNotMatch(skillText, /loadFollowupInstructionsCommand|pass actual worker id to continue|Then run this single continue command/);
});
