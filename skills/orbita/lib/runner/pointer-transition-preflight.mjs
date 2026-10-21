/** Validates phase-deferred fanout owner inputs before a pointer move is persisted. */
import { WorkflowRuntimeError } from '../errors.mjs';
import { parsePathExpression } from '../runtime/expression.mjs';
import { batonForFanoutPrompt, isFanoutStep } from '../runtime/fanout.mjs';
import { validateAgainstOutputSchema } from '../runtime/output/output-schema-validation.mjs';
import { extractPromptInterpolations, interpolatePromptExpressions } from '../runtime/prompt-interpolation.mjs';
import { normalizePromptText } from '../runtime/prompt-text.mjs';

function promptWithoutDeferredBranchInputs(prompt, selectedBranchIds) {
  let preflightPrompt = prompt;
  for (const interpolation of extractPromptInterpolations(prompt)) {
    if (interpolation.expression.root !== 'input') continue;
    const [sourceStepId] = interpolation.expression.path;
    if (!selectedBranchIds.has(sourceStepId)) continue;
    preflightPrompt = preflightPrompt.split(interpolation.expression.source).join('');
  }
  return preflightPrompt;
}

function branchSelectionExpressions(targetStep) {
  const selection = targetStep.input?.branches;
  if (typeof selection === 'string') return [selection];
  if (selection && typeof selection === 'object' && !Array.isArray(selection)) return selection.first_of ?? [];
  return [];
}

function referencedInputStepIds(targetStep, prompt) {
  const stepIds = new Set();
  for (const interpolation of extractPromptInterpolations(prompt)) {
    if (interpolation.expression.root === 'input') stepIds.add(interpolation.expression.path[0]);
  }
  for (const source of branchSelectionExpressions(targetStep)) {
    const expression = parsePathExpression(source);
    if (expression.root === 'input') stepIds.add(expression.path[0]);
  }
  return stepIds;
}

function outputSchema(resources, schemaRef) {
  const loaded = resources?.outputSchemas instanceof Map
    ? resources.outputSchemas.get(schemaRef)
    : resources?.outputSchemas?.[schemaRef];
  return loaded?.schema ?? loaded;
}

function assertReferencedStateMatchesCurrentContracts({ workflow, baton, resources, targetStepId, targetStep, prompt, selectedBranchIds }) {
  for (const sourceStepId of referencedInputStepIds(targetStep, prompt)) {
    if (selectedBranchIds.has(sourceStepId)) continue;
    const sourceOutput = baton.state?.[sourceStepId];
    if (sourceOutput === undefined) continue;
    const schemaRef = workflow.steps?.[sourceStepId]?.output?.schema;
    if (!schemaRef) continue;
    const validation = validateAgainstOutputSchema({
      schemaRef,
      schema: outputSchema(resources, schemaRef),
      output: sourceOutput,
    });
    if (!validation.ok) {
      throw new WorkflowRuntimeError(
        `pointer move preflight failed for target '${targetStepId}': persisted input '${sourceStepId}' does not satisfy the current output contract: ${validation.errors}`,
      );
    }
  }
}

function batonForPreflightPrompt({ workflow, baton, targetStepId, activation, transition }) {
  if (transition?.direction !== 'resume') return baton;
  return batonForFanoutPrompt({
    workflow,
    baton,
    entry: {
      id: targetStepId,
      fanout: {
        owner_step_id: targetStepId,
        phase: 'owner',
        selected_branch_ids: activation.selected_branch_ids,
      },
    },
  });
}

export function assertPointerMoveTargetPreflight({ workflow, baton, resources, transition } = {}) {
  const targetStepId = baton?.cursor;
  const targetStep = workflow?.steps?.[targetStepId];
  if (!isFanoutStep(targetStep)) return;

  const activation = baton?.state?.fanouts?.[targetStepId];
  if (!activation || !Array.isArray(activation.selected_branch_ids)) {
    throw new WorkflowRuntimeError(`pointer move preflight failed for target '${targetStepId}': fanout activation is missing`);
  }

  const prompt = normalizePromptText(targetStep.input?.prompt);
  const selectedBranchIds = new Set(activation.selected_branch_ids);
  assertReferencedStateMatchesCurrentContracts({
    workflow,
    baton,
    resources,
    targetStepId,
    targetStep,
    prompt,
    selectedBranchIds,
  });
  const preflightPrompt = promptWithoutDeferredBranchInputs(prompt, selectedBranchIds);
  const promptBaton = batonForPreflightPrompt({ workflow, baton, targetStepId, activation, transition });
  try {
    interpolatePromptExpressions(preflightPrompt, { input: promptBaton.state ?? {} });
  } catch (error) {
    throw new WorkflowRuntimeError(`pointer move preflight failed for target '${targetStepId}': ${error.message}`);
  }
}
