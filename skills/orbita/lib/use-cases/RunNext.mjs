/** RunNext returns validated neutral executable entries without consumer rendering. */
import { assertResponseSchema } from '../runtime/output/response-schema.mjs';
import { assertLoadedWorkflowAndBaton } from '../runtime/guards/workflow.mjs';
import { responseForCursor } from '../runtime/output/response.mjs';

export function runNext({ workflowDoc, batonDoc, resources } = {}) {
  const { workflow, baton } = assertLoadedWorkflowAndBaton(workflowDoc, batonDoc, { allowedRoles: resources?.allowedRoles, outputSchemas: resources?.outputSchemas });
  const response = responseForCursor(baton, workflow);
  assertResponseSchema(response);
  return response;
}

export const RunNext = { execute: runNext };
