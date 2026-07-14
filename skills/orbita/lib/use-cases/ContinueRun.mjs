/** ContinueRun applies output and returns the next neutral executable response. */
import { assertResponseSchema } from '../runtime/output/response-schema.mjs';
import { applyWorkflowOutput } from '../runtime/workflow-output/apply.mjs';
import { assertLoadedWorkflowAndBaton } from '../runtime/guards/workflow.mjs';

export function renderAppliedResponse({ workflowDoc, response, resources } = {}) {
  assertLoadedWorkflowAndBaton(workflowDoc, response.baton, { allowedRoles: resources?.allowedRoles, outputSchemas: resources?.outputSchemas });
  assertResponseSchema(response);
  return response;
}

export function continueRun({ workflowDoc, batonDoc, outputContent, outputValue, resources, includeDiagnostics = false } = {}) {
  const applied = applyWorkflowOutput({ workflowDoc, batonDoc, outputContent, outputValue, resources });
  return renderAppliedResponse({ workflowDoc, response: applied, resources, includeDiagnostics });
}

export const ContinueRun = { execute: continueRun };
