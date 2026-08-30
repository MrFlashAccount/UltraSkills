/** RunNext returns validated neutral executable entries without consumer rendering. */
import { assertResponseSchema } from '../runtime/output/response-schema.mjs';
import { assertLoadedWorkflowAndBaton } from '../runtime/guards/workflow.mjs';
import { responseForCursor, responseForStepEntry } from '../runtime/output/response.mjs';

function runWithResponse({ workflowDoc, batonDoc, resources }, responseFor) {
  const { workflow, baton } = assertLoadedWorkflowAndBaton(workflowDoc, batonDoc, { allowedRoles: resources?.allowedRoles, outputSchemas: resources?.outputSchemas });
  const response = responseFor(baton, workflow);
  assertResponseSchema(response);
  return response;
}

export function runNext(options = {}) {
  return runWithResponse(options, responseForStepEntry);
}

export function resumeCurrentStep(options = {}) {
  return runWithResponse(options, responseForCursor);
}

export const RunNext = { execute: runNext };
