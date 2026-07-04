import { validateWorkflowDocument } from '../../entities/Workflow/index.mjs';
import { validateBatonDataAgainstWorkflow } from '../../entities/Baton/index.mjs';
import { workflowSemanticValidationOptions } from '../workflow-semantic-validation.mjs';

export function assertLoadedWorkflowAndBaton(workflowDoc, batonDoc, options = {}) {
  const workflow = typeof workflowDoc?.toJSON === 'function' ? workflowDoc.toJSON() : workflowDoc;
  validateWorkflowDocument(workflow, workflowSemanticValidationOptions(options));
  const batonData = typeof batonDoc?.toJSON === 'function' ? batonDoc.toJSON() : structuredClone(batonDoc);
  validateBatonDataAgainstWorkflow(batonData, workflow);
  const cursorStepId = Array.isArray(batonData.cursor) ? batonData.cursor[0] : batonData.cursor;
  const cursorStep = structuredClone(workflow.steps[cursorStepId]);
  return { workflow, baton: batonData, cursorStep };
}
