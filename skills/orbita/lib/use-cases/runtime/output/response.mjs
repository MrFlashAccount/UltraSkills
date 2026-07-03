import { buildStepEntries, buildStepEntry } from '../../executable-steps.mjs';
import { invariant } from '../../../errors.mjs';
import { appendPromptText } from '../../../runtime/prompt-text.mjs';
import { assertResponseSchema } from './response-schema.mjs';
import { normalizeCursor } from '../../../runtime/cursor.mjs';
import { batonWithShardPlan, isShardedStep, shardPlanForBaton, shardedStepEntries } from '../../../entities/Baton/sharding.mjs';

export function hasAppliedOutputForStep(baton, stepId) {
  return Boolean(baton.state && Object.hasOwn(baton.state, stepId));
}

export function responseFor(baton, stepId, step, workflow, { parallelTargets = false } = {}) {
  if (parallelTargets) invariant(workflow && Array.isArray(step.next), `workflow step '${stepId}' cannot expose parallel branch steps`);
  const response = { baton, steps: buildStepEntries(stepId, step, workflow, { parallelTargets }) };
  assertResponseSchema(response);
  return response;
}

export function responseForCursor(baton, workflow) {
  const stepIds = normalizeCursor(baton.cursor);
  let responseBaton = baton;
  const steps = stepIds.flatMap((stepId) => {
    const step = workflow.steps?.[stepId];
    invariant(step, `baton cursor not found in workflow: ${stepId}`);
    if (isShardedStep(step)) {
      const plan = shardPlanForBaton({ baton: responseBaton, ownerStepId: stepId, ownerStep: step });
      responseBaton = batonWithShardPlan(responseBaton, stepId, plan);
      return shardedStepEntries(stepId, step, responseBaton);
    }
    return buildStepEntry(stepId, step);
  });
  const response = { baton: responseBaton, steps };
  assertResponseSchema(response);
  return response;
}

export function stepWithValidationFeedback(step, feedbackPrompt) {
  const updatedStep = structuredClone(step);
  updatedStep.input = {
    ...(updatedStep.input ?? {}),
    prompt: appendPromptText(updatedStep.input?.prompt, feedbackPrompt),
  };
  return updatedStep;
}
