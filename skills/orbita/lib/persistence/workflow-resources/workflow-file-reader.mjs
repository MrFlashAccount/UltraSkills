/** Filesystem adapter for workflow boundary documents and referenced output schemas. */
import { loadOutputSchema } from './output-schema-loader.mjs';
import { defaultRepositoryRootForWorkflow } from './resource-resolver.mjs';
import { WorkflowDTO } from '../../dtos/WorkflowDTO.mjs';
import { listAllowedWorkflowRoles } from './role-material-catalog.mjs';
import { assertWorkflowSchema } from '../../file-contracts/workflow-document-schema.mjs';
import { readWorkflowDocument } from './workflow-document-reader.mjs';

export function read(path) {
  const workflow = readWorkflowDocument(path, 'workflow');
  assertWorkflowSchema(workflow);
  return new WorkflowDTO(workflow);
}

export function readOutputSchemas({ workflow, workflowPath, repositoryRoot = defaultRepositoryRootForWorkflow(workflowPath) }) {
  const doc = typeof workflow?.toJSON === 'function' ? workflow.toJSON() : workflow;
  const outputSchemas = new Map();
  for (const [stepId, step] of Object.entries(doc.steps ?? {})) {
    const schemaEntries = [
      [stepId, step.output?.schema],
      [`${stepId}.worker`, step.worker?.output?.schema],
      ...Object.entries(step.branches ?? {}).map(([branchId, branch]) => [`${stepId}.branches.${branchId}`, branch?.output?.schema]),
    ].filter(([, schemaRef]) => Boolean(schemaRef));
    for (const [producerId, schemaRef] of schemaEntries) {
      const schema = loadOutputSchema({ workflow: doc, workflowPath, schemaRef, repositoryRoot }).schema;
      outputSchemas.set(producerId, schema);
      outputSchemas.set(schemaRef, schema);
    }
  }
  return outputSchemas;
}

export function readAllowedRoles({ repositoryRoot = defaultRepositoryRootForWorkflow('workflow.json') } = {}) {
  return listAllowedWorkflowRoles({ repositoryRoot });
}
