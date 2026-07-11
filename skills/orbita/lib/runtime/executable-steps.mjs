import { actionForStep } from './step-status.mjs';

export function buildStepEntry(stepId, step) {
  return {
    id: stepId,
    action: actionForStep(step),
    step: structuredClone(step),
  };
}
