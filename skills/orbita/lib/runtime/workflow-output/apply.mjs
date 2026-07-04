/** Applies host/worker output through Step/Baton-owned runtime behavior. */
import { assertLoadedWorkflowAndBaton } from '../guards/workflow.mjs';
import { applyNextTransition } from '../transition/next.mjs';
import { applyParallelOutputs } from '../parallel/apply.mjs';
import { normalizeCursor } from '../cursor.mjs';
import { isShardedStep } from '../sharding.mjs';
import { isMatrixStep } from '../matrix.mjs';
import { applyShardedStepOutputs } from '../sharded-step.mjs';
import { applyMatrixStepOutputs } from '../matrix-step.mjs';
import { assertOutputSchemaIfDeclared, isParallelOutputEnvelope, readWorkerOutputForStep } from '../output/worker-output.mjs';

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
  const cursorStepIds = normalizeCursor(baton.cursor);
  const hasParallelCursor = cursorStepIds.length > 1;
  const parsed = parseCandidateOutput({ outputContent, outputValue });
  const candidateOutput = parsed.value;
  if (hasParallelCursor && !isParallelOutputEnvelope(candidateOutput)) {
    throw new Error('parallel output must include object steps');
  }

  if (hasParallelCursor) {
    return applyParallelOutputs({
      workflow,
      baton,
      cursorStep: { next: cursorStepIds },
      allOutput: candidateOutput,
      targets: cursorStepIds,
      resources,
    });
  }

  const stepId = cursorStepIds[0];
  if (isShardedStep(cursorStep)) {
    return applyShardedStepOutputs({
      workflow,
      baton,
      ownerStepId: stepId,
      ownerStep: cursorStep,
      allOutput: candidateOutput,
      resources,
    });
  }
  if (isMatrixStep(cursorStep)) {
    return applyMatrixStepOutputs({
      workflow,
      baton,
      ownerStepId: stepId,
      ownerStep: cursorStep,
      allOutput: candidateOutput,
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
