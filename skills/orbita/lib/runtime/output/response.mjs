import { buildStepEntry } from '../executable-steps.mjs';
import { invariant } from '../../errors.mjs';
import { appendPromptText } from '../prompt-text.mjs';
import { assertResponseSchema } from './response-schema.mjs';
import { prepareBatonForStepEntry } from '../baton-state.mjs';
import {
  batonWithShardActivation,
  currentShardActivationWithRequests,
  isShardStep,
  shardStepEntries,
  startShardActivationWithRequests,
} from '../shard.mjs';
import {
  batonWithFanoutActivation,
  currentFanoutActivationWithRequests,
  fanoutStepEntries,
  isFanoutStep,
  startFanoutActivationWithRequests,
} from '../fanout.mjs';

export function hasAppliedOutputForStep(baton, stepId) {
  return Boolean(baton.state && Object.hasOwn(baton.state, stepId));
}

export function responseFor(baton, stepId, step) {
  const response = { baton, steps: [buildStepEntry(stepId, step)] };
  assertResponseSchema(response);
  return response;
}

function responseForCursorWithActivations(baton, workflow, { fanoutActivation, shardActivation }) {
  const stepId = baton.cursor;
  invariant(typeof stepId === 'string' && stepId.length > 0, 'baton cursor must be a non-empty workflow step id');
  let responseBaton = baton;
  const step = workflow.steps?.[stepId];
  invariant(step, `baton cursor not found in workflow: ${stepId}`);
  let steps;
  if (isShardStep(step)) {
    const activation = shardActivation({ baton: responseBaton, parentStepId: stepId, parentStep: step });
    responseBaton = batonWithShardActivation(responseBaton, stepId, activation);
    steps = shardStepEntries(stepId, step, activation);
  } else if (isFanoutStep(step)) {
    const activation = fanoutActivation({ baton: responseBaton, ownerStepId: stepId, ownerStep: step });
    responseBaton = batonWithFanoutActivation(responseBaton, stepId, activation);
    steps = fanoutStepEntries(stepId, step, activation);
  } else {
    steps = [buildStepEntry(stepId, step)];
  }
  const response = { baton: responseBaton, steps };
  assertResponseSchema(response);
  return response;
}

export function responseForCursor(baton, workflow) {
  return responseForCursorWithActivations(baton, workflow, {
    fanoutActivation: currentFanoutActivationWithRequests,
    shardActivation: currentShardActivationWithRequests,
  });
}

export function responseForStepEntry(baton, workflow) {
  return responseForCursorWithActivations(prepareBatonForStepEntry(baton, baton.cursor), workflow, {
    fanoutActivation: startFanoutActivationWithRequests,
    shardActivation: startShardActivationWithRequests,
  });
}

export function stepWithValidationFeedback(step, feedbackPrompt) {
  const updatedStep = structuredClone(step);
  updatedStep.input = {
    ...(updatedStep.input ?? {}),
    prompt: appendPromptText(updatedStep.input?.prompt, feedbackPrompt),
  };
  return updatedStep;
}
