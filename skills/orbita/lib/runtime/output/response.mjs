import { buildStepEntry } from '../executable-steps.mjs';
import { invariant } from '../../errors.mjs';
import { appendPromptText } from '../prompt-text.mjs';
import { assertResponseSchema } from './response-schema.mjs';
import { batonWithShardActivation, isShardStep, shardActivationWithRequests, shardStepEntries } from '../shard.mjs';
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
  if (isShardStep(step)) {
    const activation = shardActivationWithRequests({ baton: responseBaton, parentStepId: stepId, parentStep: step });
    responseBaton = batonWithShardActivation(responseBaton, stepId, activation);
    steps = shardStepEntries(stepId, step, responseBaton);
  } else if (isFanoutStep(step)) {
    const activation = fanoutActivationWithRequests({ baton: responseBaton, ownerStepId: stepId, ownerStep: step });
    responseBaton = batonWithFanoutActivation(responseBaton, stepId, activation);
    steps = fanoutStepEntries(stepId, step, responseBaton);
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
