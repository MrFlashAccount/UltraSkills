import { buildStepEntry } from '../executable-steps.mjs';
import { invariant } from '../../errors.mjs';
import { appendPromptText } from '../prompt-text.mjs';
import { assertResponseSchema } from './response-schema.mjs';
import { batonWithShardPlan, isShardedStep, shardPlanForBaton, shardedStepEntries } from '../sharding.mjs';
import { batonWithMatrixPlan, isMatrixStep, matrixPlanForBaton, matrixStepEntries, planWithCurrentMatrixRequests } from '../matrix.mjs';
import { batonWithFanoutActivation, fanoutActivationWithRequests, fanoutStepEntries, isFanoutStep } from '../fanout.mjs';

export function hasAppliedOutputForStep(baton, stepId) {
  return Boolean(baton.state && Object.hasOwn(baton.state, stepId));
}

export function responseFor(baton, stepId, step) {
  const response = { baton, steps: [buildStepEntry(stepId, step)] };
  assertResponseSchema(response);
  return response;
}

export function responseForCursor(baton, workflow) {
  const stepId = baton.cursor;
  invariant(typeof stepId === 'string' && stepId.length > 0, 'baton cursor must be a non-empty workflow step id');
  let responseBaton = baton;
  const step = workflow.steps?.[stepId];
  invariant(step, `baton cursor not found in workflow: ${stepId}`);
  let steps;
  if (isShardedStep(step)) {
    const plan = shardPlanForBaton({ baton: responseBaton, ownerStepId: stepId, ownerStep: step });
    responseBaton = batonWithShardPlan(responseBaton, stepId, plan);
    steps = shardedStepEntries(stepId, step, responseBaton);
  } else if (isFanoutStep(step)) {
    const activation = fanoutActivationWithRequests({ baton: responseBaton, ownerStepId: stepId, ownerStep: step });
    responseBaton = batonWithFanoutActivation(responseBaton, stepId, activation);
    steps = fanoutStepEntries(stepId, step, responseBaton);
  } else if (isMatrixStep(step)) {
    const plan = planWithCurrentMatrixRequests(matrixPlanForBaton({ baton: responseBaton, ownerStepId: stepId, ownerStep: step }));
    responseBaton = batonWithMatrixPlan(responseBaton, stepId, plan);
    steps = matrixStepEntries(stepId, step, responseBaton);
  } else {
    steps = [buildStepEntry(stepId, step)];
  }
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
