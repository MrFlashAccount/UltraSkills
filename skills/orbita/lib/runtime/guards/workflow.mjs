import { validateWorkflowDocument } from '../../entities/Workflow/index.mjs';
import { validateBatonDataAgainstWorkflow } from '../../entities/Baton/index.mjs';
import { workflowSemanticValidationOptions } from '../workflow-semantic-validation.mjs';
import { isCompiledWorkflowForRuntime } from '../compiled-workflow.mjs';

export function assertLoadedWorkflowAndBaton(workflowDoc, batonDoc, options = {}) {
  const workflow = typeof workflowDoc?.toJSON === 'function' ? workflowDoc.toJSON() : workflowDoc;
  if (!isCompiledWorkflowForRuntime(workflow, options)) {
    validateWorkflowDocument(workflow, workflowSemanticValidationOptions(options));
  }
  const batonData = typeof batonDoc?.toJSON === 'function'
    ? batonDoc.toJSON()
    : (Object.isFrozen(batonDoc) && Object.isFrozen(batonDoc?.state) ? batonDoc : structuredClone(batonDoc));
  validateBatonDataAgainstWorkflow(batonData, workflow);
  const cursorStepId = batonData.cursor;
  const cursorStep = structuredClone(workflow.steps[cursorStepId]);
  return { workflow, baton: batonData, cursorStep };
}
