import { read, readAllowedRoles, readOutputSchemas } from '../persistence/workflow-resources/workflow-file-reader.mjs';
import { defaultRepositoryRootForWorkflow } from '../persistence/workflow-resources/resource-resolver.mjs';
import { validateWorkflow } from '../use-cases/ValidateWorkflow.mjs';
import { createValidateWorkflowFile } from '../use-cases/ValidateWorkflowFile.mjs';

export const validateWorkflowFile = createValidateWorkflowFile({
  readWorkflow: read,
  readOutputSchemas,
  readAllowedRoles,
  defaultRepositoryRootForWorkflow,
  validateWorkflow,
});
