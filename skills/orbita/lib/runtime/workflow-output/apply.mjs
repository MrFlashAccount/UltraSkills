/** Applies host/worker output through Step/Baton-owned runtime behavior. */
import { assertLoadedWorkflowAndBaton } from '../guards/workflow.mjs';
import { applyNextTransition } from '../transition/next.mjs';
import { isShardStep } from '../shard.mjs';
import { applyShardStepOutput } from '../shard-step.mjs';
import { assertOutputSchemaIfDeclared, readWorkerOutputForStep } from '../output/worker-output.mjs';
import { isFanoutStep } from '../fanout.mjs';
import { applyFanoutStepOutput } from '../fanout-step.mjs';

function parseCandidateOutput({ outputContent, outputValue }) {
  if (outputValue !== undefined) return { value: outputValue, error: undefined };
  try {
    return { value: JSON.parse(outputContent), error: undefined };
  } catch (error) {
    return { value: undefined, error };
  }
}

export function applyWorkflowOutput({ workflowDoc, batonDoc, outputContent, outputValue, resources } = {}) {
  const { workflow, baton, cursorStep } = assertLoadedWorkflowAndBaton(workflowDoc, batonDoc, { allowedRoles: resources?.allowedRoles, outputSchemas: resources?.outputSchemas });
  const parsed = parseCandidateOutput({ outputContent, outputValue });
  const candidateOutput = parsed.value;
  const stepId = baton.cursor;
  if (isShardStep(cursorStep)) {
    return applyShardStepOutput({
      workflow,
      baton,
      parentStepId: stepId,
      parentStep: cursorStep,
      allOutput: candidateOutput,
      outputParseError: parsed.error,
      resources,
    });
  }
  if (isFanoutStep(cursorStep)) {
    return applyFanoutStepOutput({
      workflow,
      baton,
      ownerStepId: stepId,
      ownerStep: cursorStep,
      allOutput: candidateOutput,
      outputParseError: parsed.error,
      resources,
    });
  }
  const readResult = readWorkerOutputForStep({ baton, stepId, step: cursorStep, allOutput: candidateOutput, outputParseError: parsed.error });
  if (readResult.retryResponse) return readResult.retryResponse;
  const { workerOutput, retryResponse } = assertOutputSchemaIfDeclared({
    baton,
    stepId,
    step: cursorStep,
    workerOutput: readResult.workerOutput,
    resources,
  });
  if (retryResponse) return retryResponse;

  return applyNextTransition({ workflow, baton, cursorStep, workerOutput, stepId });
}
