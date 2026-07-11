import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'bun:test';
import { Step } from '../entities/Step/index.mjs';
import { readWorkflowDocument } from '../persistence/workflow-resources/workflow-document-reader.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const WORKFLOWS_ROOT = path.join(REPO_ROOT, 'workflows');
const devHarness = readWorkflowDocument(path.join(REPO_ROOT, 'workflows/dev-harness/workflow.toml'));
const researchCritic = readWorkflowDocument(path.join(REPO_ROOT, 'workflows/research-critic/workflow.toml'));
const workflowAuthoring = readWorkflowDocument(path.join(REPO_ROOT, 'workflows/workflow-authoring/workflow.json'));

const catalogWorkflows = readdirSync(WORKFLOWS_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const directory = path.join(WORKFLOWS_ROOT, entry.name);
    const workflowPath = ['workflow.toml', 'workflow.json']
      .map((fileName) => path.join(directory, fileName))
      .find((candidate) => existsSync(candidate));
    return workflowPath ? { workflowPath, workflow: readWorkflowDocument(workflowPath) } : undefined;
  })
  .filter(Boolean);

const revisionGates = [
  {
    label: 'dev-harness research',
    workflow: devHarness,
    draftId: 'research_draft',
    attackId: 'research_attack',
    approvalId: 'approve_research',
    schemaPath: 'workflows/dev-harness/schemas/research-draft-output.json',
  },
  {
    label: 'dev-harness architecture',
    workflow: devHarness,
    draftId: 'architecture_draft',
    attackId: 'architecture_attack',
    approvalId: 'approve_architecture',
    schemaPath: 'workflows/dev-harness/schemas/architecture-draft-output.json',
  },
  {
    label: 'dev-harness implementation plan',
    workflow: devHarness,
    draftId: 'planning_draft',
    attackId: 'planning_attack',
    approvalId: 'approve_plan',
    schemaPath: 'workflows/dev-harness/schemas/planning-draft-output.json',
  },
  {
    label: 'workflow-authoring design',
    workflow: workflowAuthoring,
    draftId: 'workflow_design_draft',
    attackId: 'workflow_design_attack',
    approvalId: 'approve_workflow_design',
    schemaPath: 'workflows/workflow-authoring/schemas/workflow-design-draft-output.json',
  },
];

function applyStep(workflow, baton, stepId, output) {
  return new Step({ id: stepId, step: workflow.steps[stepId] }).applyOutput({ workflow, baton, output }).baton;
}

for (const gate of revisionGates) {
  test(`${gate.label}: first draft is attacked but a user-rejected revision returns directly to approval`, () => {
    const { workflow, draftId, attackId, approvalId } = gate;
    let baton = {
      cursor: draftId,
      status: 'running',
      state: { artifacts: [], results: [] },
    };

    baton = applyStep(workflow, baton, draftId, { outcome: 'ready_for_attack' });
    assert.equal(baton.cursor, attackId);

    baton = applyStep(workflow, baton, attackId, { outcome: 'approved' });
    assert.equal(baton.cursor, approvalId);

    baton = applyStep(workflow, baton, approvalId, { approval: 'rejected', feedback: 'Apply the requested correction.' });
    assert.equal(baton.cursor, draftId);

    baton = applyStep(workflow, baton, draftId, { outcome: 'ready_for_approval' });
    assert.equal(baton.cursor, approvalId);
    assert.notEqual(baton.cursor, attackId);
  });

  test(`${gate.label}: draft schema and prompts expose the direct repeat-approval contract`, () => {
    const { workflow, draftId, attackId, approvalId, schemaPath } = gate;
    const draft = workflow.steps[draftId];
    const approval = workflow.steps[approvalId];
    const schema = JSON.parse(readFileSync(path.join(REPO_ROOT, schemaPath), 'utf8'));
    const successRequirement = schema.allOf?.find((branch) => branch.if?.properties?.outcome?.enum?.includes('ready_for_approval'));
    const draftPrompt = Array.isArray(draft.input?.prompt) ? draft.input.prompt.join('\n') : draft.input?.prompt ?? '';
    const approvalPrompt = Array.isArray(approval.input?.prompt) ? approval.input.prompt.join('\n') : approval.input?.prompt ?? '';

    assert.equal(draft.next.cases.ready_for_attack, attackId);
    assert.equal(draft.next.cases.ready_for_approval, approvalId);
    assert.equal(approval.next.cases.rejected, draftId);
    assert.ok(schema.properties.outcome.enum.includes('ready_for_attack'));
    assert.ok(schema.properties.outcome.enum.includes('ready_for_approval'));
    assert.ok(successRequirement?.then?.required?.length > 0);
    assert.match(draftPrompt, /ready_for_approval/);
    assert.match(approvalPrompt, /previous version/);
  });
}

test('question and optional-decision approvals keep their non-revision semantics', () => {
  assert.equal(researchCritic.steps.ask_research_questions.next.cases.rejected, undefined);
  assert.equal(workflowAuthoring.steps.approve_reviewed_improvement.next.cases.rejected, 'workflow_implementation_attack');
  assert.equal(workflowAuthoring.steps.workflow_implementation_attack.next.cases.needs_revision, 'workflow_implementation');
});

test('catalog workflows cannot force a user-rejected revision through the same critic again', () => {
  for (const { workflowPath, workflow } of catalogWorkflows) {
    for (const [approvalId, approval] of Object.entries(workflow.steps)) {
      if (approval.kind !== 'approval') continue;
      const revisionId = approval.next?.cases?.rejected;
      const revision = workflow.steps[revisionId];
      if (revision?.kind !== 'worker') continue;

      const revisionTargets = Object.values(revision.next?.cases ?? {});
      const repeatsCritique = revisionTargets.some((candidateId) => {
        if (candidateId === approvalId) return false;
        const candidateTargets = Object.values(workflow.steps[candidateId]?.next?.cases ?? {});
        return candidateTargets.includes(approvalId);
      });

      if (repeatsCritique) {
        assert.ok(
          revisionTargets.includes(approvalId),
          `${path.relative(REPO_ROOT, workflowPath)} approval '${approvalId}' must let '${revisionId}' return directly to the same gate after user rejection`,
        );
      }
    }
  }
});
