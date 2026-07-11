const SAFE_WORKFLOW_STEP_ID = /^[A-Za-z0-9_.-]+$/;

export function isSafeWorkflowStepId(stepId) {
  return typeof stepId === 'string'
    && SAFE_WORKFLOW_STEP_ID.test(stepId)
    && stepId !== '.'
    && stepId !== '..';
}

export function assertSafeWorkflowStepId(stepId, { errorPrefix = 'invalid workflow step id for runner storage' } = {}) {
  if (!isSafeWorkflowStepId(stepId)) throw new Error(`${errorPrefix}: ${stepId}`);
}
