import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'bun:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkflowDocument } from '../persistence/workflow-resources/workflow-document-reader.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const workflowDoc = readWorkflowDocument(path.join(REPO_ROOT, 'workflows/spdd/workflow.toml'));

function promptText(step) {
  const prompt = step.input?.prompt ?? '';
  return Array.isArray(prompt) ? prompt.join('\n') : prompt;
}

test('spdd implementation branches consume only their owner-written rework handoff', () => {
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

test('Orbita skill releases a lease only through the explicit matching-token command', () => {
  const skillText = readFileSync(path.join(REPO_ROOT, 'skills/orbita/SKILL.md'), 'utf8');
  assert.match(skillText, /Only on explicit release, and never while a worker owns work/);
  assert.match(skillText, /workflow-runs\.mjs" release --run-id <run-id> --lease-token "\$lease_token"/);
});

test('Orbita skill explains direct rollback to state-bearing workflow predecessors', () => {
  const skillText = readFileSync(path.join(REPO_ROOT, 'skills/orbita/SKILL.md'), 'utf8');
  assert.match(skillText, /every valid predecessor present in `baton\.state`/);
  assert.match(skillText, /never debug history or downstream steps/);
  assert.match(skillText, /Choose the target and move once/);
  assert.match(skillText, /re-enters it without acknowledgement/);
  assert.match(skillText, /only that step's prior output and stop are invalidated/);
  assert.match(skillText, /append-only and unrelated state stay/);
  assert.doesNotMatch(skillText, /acknowledge-retained-state/);
});

test('Orbita skill stays bounded and delegates dynamic request protocol to runner stdout', () => {
  const skillText = readFileSync(path.join(REPO_ROOT, 'skills/orbita/SKILL.md'), 'utf8');
  assert.ok(Buffer.byteLength(skillText) <= 9_000, 'Orbita SKILL.md exceeded the 9 KB always-loaded budget');
  assert.match(skillText, /stdout is the sole active directive/);
  assert.match(skillText, /already supplies current actions, dynamic commands, schemas, bindings, approval text, continuation, and terminal JSON/);
  assert.doesNotMatch(skillText, /loadFollowupInstructionsCommand|pass actual worker id to continue|Then run this single continue command/);
});
