/** InspectWorkflow use-case returns a fresh unrendered step-entry response contract. */
import { assertLoadedWorkflowAndBaton } from '../runtime/guards/workflow.mjs';
import { responseForStepEntry } from '../runtime/output/response.mjs';

export function inspectWorkflow({ workflowDoc, batonDoc, resources } = {}) {
  const { workflow, baton } = assertLoadedWorkflowAndBaton(workflowDoc, batonDoc, { allowedRoles: resources?.allowedRoles, outputSchemas: resources?.outputSchemas });
  return responseForStepEntry(baton, workflow);
}

export const InspectWorkflow = { execute: inspectWorkflow };
