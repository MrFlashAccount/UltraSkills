import { WorkflowRuntimeError } from '../errors.mjs';

export function createValidateWorkflowFile({
  readWorkflow,
  readOutputSchemas,
  readAllowedRoles,
  defaultRepositoryRootForWorkflow,
  validateWorkflow,
}) {
  return function validateWorkflowFile(workflowPath, options = {}) {
    if (typeof workflowPath !== 'string' || workflowPath.length === 0) {
      throw new WorkflowRuntimeError('workflow path is required');
    }
    const workflowDTO = readWorkflow(workflowPath);
    const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRootForWorkflow(workflowPath);
    const outputSchemas = readOutputSchemas({ workflow: workflowDTO, workflowPath, repositoryRoot });
    const allowedRoles = readAllowedRoles({ repositoryRoot });
    return validateWorkflow({ workflowDTO, outputSchemas, allowedRoles }).toJSON();
  };
}
