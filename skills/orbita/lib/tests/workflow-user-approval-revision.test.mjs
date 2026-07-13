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
const frontendUiPrSmoke = readWorkflowDocument(path.join(REPO_ROOT, 'workflows/frontend-ui-pr-smoke/workflow.toml'));
const researchCritic = readWorkflowDocument(path.join(REPO_ROOT, 'workflows/research-critic/workflow.toml'));
const workflowAuthoring = readWorkflowDocument(path.join(REPO_ROOT, 'workflows/workflow-authoring/workflow.json'));
const uiProposalTemplate = readFileSync(path.join(REPO_ROOT, 'shared/templates/ui-design-proposal-template.html'), 'utf8');
const implementationPlanTemplate = readFileSync(path.join(REPO_ROOT, 'shared/templates/implementation-plan-template.md'), 'utf8');
const sharedTemplatesReadme = readFileSync(path.join(REPO_ROOT, 'shared/templates/README.md'), 'utf8');
const devUiDraftSchema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'workflows/dev-harness/schemas/ui-intent-draft-output.json'), 'utf8'));
const smokeDesignDraftSchema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'workflows/frontend-ui-pr-smoke/schemas/design-draft-output.json'), 'utf8'));
const smokeImplementationFanoutSchema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'workflows/frontend-ui-pr-smoke/schemas/implementation-fanout-output.json'), 'utf8'));
const smokeReviewFanoutSchema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'workflows/frontend-ui-pr-smoke/schemas/review-fanout-output.json'), 'utf8'));
const smokePullRequestSchema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'workflows/frontend-ui-pr-smoke/schemas/pull-request-output.json'), 'utf8'));

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
    label: 'frontend-ui-pr-smoke design',
    workflow: frontendUiPrSmoke,
    draftId: 'design_draft',
    attackId: 'design_attack',
    approvalId: 'approve_design',
    schemaPath: 'workflows/frontend-ui-pr-smoke/schemas/design-draft-output.json',
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

test('frontend design gates preserve approved HTML and proof context through implementation and taste review', () => {
  const devDraft = devHarness.steps.ui_intent_draft;
  const devAttack = devHarness.steps.ui_intent_attack;
  const devImplementation = devHarness.steps.implementation.branches.frontend_implementation;
  const devTasteReview = devHarness.steps.review.branches.frontend_taste_review;
  const smokeAttack = frontendUiPrSmoke.steps.design_attack;
  const smokeImplementation = frontendUiPrSmoke.steps.implementation.branches.frontend_implementation;
  const smokeTasteReview = frontendUiPrSmoke.steps.review.branches.frontend_taste_review;
  const prompts = [devImplementation, devTasteReview, smokeImplementation, smokeTasteReview]
    .map((step) => Array.isArray(step.input.prompt) ? step.input.prompt.join('\n') : step.input.prompt ?? '');

  assert.equal(devDraft.agent, 'frontend-taste');
  assert.equal(devDraft.input.role, 'frontend-taste');
  assert.equal(devAttack.agent, 'ui_intent_critic');
  assert.notEqual(devAttack.agent, devDraft.agent, 'Dev Harness hostile attack must request a fresh worker instead of reusing the proposal author');
  assert.equal(devAttack.input.role, 'frontend-taste');
  assert.equal(smokeAttack.agent, 'design_critic');
  assert.notEqual(smokeAttack.agent, frontendUiPrSmoke.steps.design_draft.agent, 'smoke hostile attack must request a fresh worker instead of reusing the proposal author');
  assert.equal(smokeAttack.input.role, 'frontend-taste');
  assert.match(devAttack.input.prompt, /typography or rhythm/);
  assert.match(devAttack.input.prompt, /Do not invent `DESIGN\.md`/);
  for (const attack of [devAttack, smokeAttack]) {
    const attackPrompt = Array.isArray(attack.input.prompt) ? attack.input.prompt.join('\n') : attack.input.prompt;
    assert.match(attackPrompt, /3-4 viable directions/);
    assert.match(attackPrompt, /each direction to have its own inspectable rendered composition frame/);
    assert.match(attackPrompt, /product-relevant structural\/composition difference/);
    assert.match(attackPrompt, /visible demonstration of typography\/rhythm, spacing\/composition, emphasis\/contrast, focus-visible\/target affordance, and motion\/reduced-motion/);
    assert.match(attackPrompt, /Reject prose-only direction comparison/);
    assert.match(attackPrompt, /identical or near-identical frames merely relabeled or recolored/);
    assert.match(attackPrompt, /filled contract tables or checklists unsupported by (the )?rendered frames/);
    assert.match(attackPrompt, /exact existing pattern and evidence being preserved/);
  }
  assert.match(frontendUiPrSmoke.steps.design_draft.input.prompt, /3-4 viable visual\/composition directions/);
  assert.match(devHarness.steps.planning_draft.input.prompt, /both frontend_review and frontend_taste_review/);
  assert.match(devHarness.steps.planning_attack.input.prompt, /both frontend_review and frontend_taste_review/);
  assert.equal(frontendUiPrSmoke.steps.approve_design.next.cases.rejected, 'design_draft');

  for (const prompt of prompts) {
    assert.match(prompt, /ui-design-proposal/);
    assert.match(prompt, /approval evidence|approve_design|approve_ui_intent/);
  }
  assert.match(prompts[0], /rendered proof/);
  assert.match(prompts[1], /compare rendered implementation proof/);
  assert.match(prompts[3], /rendered-proof fidelity/);
});

test('UI proposal contract rejects generic card-drawer routing and requires comparable visual directions plus taste fields', () => {
  const draftPrompt = Array.isArray(devHarness.steps.ui_intent_draft.input.prompt)
    ? devHarness.steps.ui_intent_draft.input.prompt.join('\n')
    : devHarness.steps.ui_intent_draft.input.prompt;
  const directionFrames = [...uiProposalTemplate.matchAll(/class="frame direction-frame"/g)];
  const directionIds = [...uiProposalTemplate.matchAll(/data-direction="([A-D])"/g)].map((match) => match[1]);
  const proposalImages = [...uiProposalTemplate.matchAll(/<img class="proposal-image" src="\.\/([^"]+)"/g)].map((match) => match[1]);
  const artifactDescription = devUiDraftSchema.properties.artifacts.description;
  const artifactUsage = devUiDraftSchema.properties.artifacts['x-usage'];

  assert.doesNotMatch(draftPrompt, /product-level data hierarchy, card anatomy\/content model, card visual rules, drawer\/sidebar placement and states/);
  assert.match(draftPrompt, /Include card\/list anatomy and visual rules only when that pattern is selected/);
  assert.doesNotMatch(uiProposalTemplate, /facts hidden until detail\/drawer/);
  assert.doesNotMatch(uiProposalTemplate, /buttons, icon buttons, chips, badges, cards, drawers, tables/);
  assert.deepEqual(directionIds, ['A', 'B', 'C', 'D']);
  assert.equal(directionFrames.length, 4);
  assert.deepEqual(proposalImages, [
    'ui-direction-a.png',
    'ui-direction-b.png',
    'ui-direction-c.png',
    'ui-direction-d.png',
    'ui-selected-desktop.png',
    'ui-flow-01.png',
    'ui-flow-02.png',
    'ui-flow-03.png',
    'ui-flow-04.png',
    'ui-state-loading.png',
    'ui-state-empty.png',
    'ui-state-error.png',
    'ui-state-pathological-data.png',
    'ui-selected-mobile.png',
  ]);
  assert.doesNotMatch(uiProposalTemplate, /surface-placeholder/);
  assert.match(uiProposalTemplate, /Each direction needs its own rendered composition frame/);
  for (const field of [
    'Typography scale / rhythm',
    'Spacing / composition',
    'Color / emphasis / contrast',
    'Focus-visible / target affordance',
    'Motion / reduced-motion',
  ]) {
    assert.match(uiProposalTemplate, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(sharedTemplatesReadme, /REASONS evidence chain/);
  assert.match(sharedTemplatesReadme, /sibling raster image artifacts/);
  assert.match(sharedTemplatesReadme, /selected-pattern contracts remain conditional/);
  assert.match(artifactDescription, /ready_for_attack or ready_for_approval/);
  assert.match(artifactUsage, /both ready_for_attack and ready_for_approval/);
  assert.match(artifactUsage, /linked raster image artifact/);
  assert.equal(devUiDraftSchema.properties.artifacts.maxItems, 16);
  assert.equal(smokeDesignDraftSchema.properties.artifacts.maxItems, 16);
  for (const schema of [devUiDraftSchema, smokeDesignDraftSchema]) {
    const imageContentTypes = schema.properties.artifacts.allOf[0].items.anyOf[1].properties.content_type.enum;
    assert.deepEqual(imageContentTypes, ['image/png', 'image/jpeg', 'image/webp']);
    assert.equal(schema.properties.artifacts.maxContains, 1);
  }
  for (const schema of [devUiDraftSchema, smokeDesignDraftSchema, smokeImplementationFanoutSchema, smokeReviewFanoutSchema, smokePullRequestSchema]) {
    assert.doesNotMatch(JSON.stringify(schema), /"blocked"|"blocker"/);
  }
  assert.match(draftPrompt, /host's built-in image generation tool/);
  assert.match(draftPrompt, /shared visual brief/);
  assert.match(draftPrompt, /generated gibberish/);
  assert.match(draftPrompt, /never return only the HTML artifact|never return only HTML/);
  assert.match(frontendUiPrSmoke.steps.design_draft.input.prompt, /host's built-in image generation tool/);
  assert.match(frontendUiPrSmoke.steps.design_attack.input.prompt, /renders proposed screens with HTML\/CSS\/SVG\/canvas instead of ordinary raster image artifacts/);
  assert.match(frontendUiPrSmoke.steps.design_attack.input.prompt, /cross-view drift/);
  assert.doesNotMatch(draftPrompt, /return blocked|blocker\.source_step_id/);
  assert.doesNotMatch(frontendUiPrSmoke.steps.design_draft.input.prompt, /return blocked|blocker\.source_step_id/);
  assert.doesNotMatch(implementationPlanTemplate, /return blocked|blocker\.source_step_id/);
  assert.match(implementationPlanTemplate, /report a non-blocking stop through the runner control channel requesting plan revision/);
});

test('UI proposal template and design workers preserve the REASONS visual-evidence checkpoint', () => {
  const devDraftPrompt = Array.isArray(devHarness.steps.ui_intent_draft.input.prompt)
    ? devHarness.steps.ui_intent_draft.input.prompt.join('\n')
    : devHarness.steps.ui_intent_draft.input.prompt;
  const devAttackPrompt = Array.isArray(devHarness.steps.ui_intent_attack.input.prompt)
    ? devHarness.steps.ui_intent_attack.input.prompt.join('\n')
    : devHarness.steps.ui_intent_attack.input.prompt;
  const smokeDraftPrompt = Array.isArray(frontendUiPrSmoke.steps.design_draft.input.prompt)
    ? frontendUiPrSmoke.steps.design_draft.input.prompt.join('\n')
    : frontendUiPrSmoke.steps.design_draft.input.prompt;
  const smokeAttackPrompt = Array.isArray(frontendUiPrSmoke.steps.design_attack.input.prompt)
    ? frontendUiPrSmoke.steps.design_attack.input.prompt.join('\n')
    : frontendUiPrSmoke.steps.design_attack.input.prompt;
  const expectedSections = [
    'requirements',
    'entities',
    'approach',
    'structure',
    'operations',
    'norms',
    'safeguards',
  ];
  const templateViews = [...uiProposalTemplate.matchAll(/<section class="reason-view(?: active)?" id="([^"]+)">/g)]
    .map((match) => match[1]);
  const templateTabs = [...uiProposalTemplate.matchAll(/class="reason-tab" data-view="([^"]+)"/g)]
    .map((match) => match[1]);

  assert.deepEqual(templateViews, expectedSections);
  assert.deepEqual(templateTabs, expectedSections);
  assert.match(uiProposalTemplate, /What must the interface make true\?/);
  assert.match(uiProposalTemplate, /Functional requirements/);
  assert.match(uiProposalTemplate, /Interaction requirements/);
  assert.match(uiProposalTemplate, /Information requirements/);
  assert.match(uiProposalTemplate, /Quality \/ non-functional/);
  assert.match(uiProposalTemplate, /Observable · solution-independent · testable · prioritized/);
  const requirementsSection = uiProposalTemplate.match(
    /<section class="reason-view active" id="requirements">[\s\S]*?(?=<section class="reason-view" id="entities">)/,
  )?.[0] ?? '';
  assert.notEqual(requirementsSection, '');
  assert.doesNotMatch(
    requirementsSection,
    /<img\b/,
  );
  assert.match(uiProposalTemplate, /Domain map/);
  assert.match(uiProposalTemplate, /Comparison contract:<\/strong> same content, scenario, state, selected object, and viewport/);
  assert.match(uiProposalTemplate, /Composition anatomy/);
  assert.match(uiProposalTemplate, /Behavior sequence/);
  assert.match(uiProposalTemplate, /Interface constitution/);
  assert.match(uiProposalTemplate, /Failure boundary/);
  assert.match(uiProposalTemplate, /A flat image gallery without a stated trade-off and evidence link is invalid/);

  for (const draftPrompt of [devDraftPrompt, smokeDraftPrompt]) {
    assert.match(draftPrompt, /REASONS interface as the mandatory content architecture/);
    assert.match(draftPrompt, /Requirements = a short prioritized solution-independent interface contract/);
    assert.match(draftPrompt, /functional capabilities, interaction behavior, information\/content, non-functional quality constraints/);
    assert.match(draftPrompt, /Requirements is intentionally text-first/);
    assert.match(draftPrompt, /MUST.*SHOULD/);
    assert.match(draftPrompt, /do not place a selected-direction mockup/);
    assert.match(draftPrompt, /Entities = a domain-object relationship map/);
    assert.match(draftPrompt, /Approach = controlled direction comparison/);
    assert.match(draftPrompt, /Structure = annotated chosen-surface anatomy and containment/);
    assert.match(draftPrompt, /Operations = a primary-scenario storyboard/);
    assert.match(draftPrompt, /Norms = observable interface laws/);
    assert.match(draftPrompt, /Safeguards = rendered stress cases and approval gates/);
    assert.match(draftPrompt, /gallery/);
  }

  for (const attackPrompt of [devAttackPrompt, smokeAttackPrompt]) {
    assert.match(attackPrompt, /full REASONS (?:visual-)?evidence chain/);
    assert.match(attackPrompt, /Requirements.*prioritized.*functional\/interaction\/information\/quality contract/);
    assert.match(attackPrompt, /text-first exception/);
    assert.match(attackPrompt, /selected-direction mockup/);
    assert.match(attackPrompt, /restyled .*Markdown document|Markdown-like document merely restyled/);
    assert.match(attackPrompt, /proposal (?:made|that consists) primarily of .*direction images|proposal that consists mainly of 3-4 direction images/);
    assert.match(attackPrompt, /Structure annotated anatomy/);
    assert.match(attackPrompt, /Operations (?:a )?storyboard/);
    assert.match(attackPrompt, /Safeguards rendered stress cases and approval gates/);
  }
});

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

test('optional-decision approvals keep their non-revision semantics', () => {
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
