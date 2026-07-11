import { readFileSync, statSync } from 'node:fs';
import { WorkflowRuntimeError } from '../../errors.mjs';
import { resolveWorkflowFileRef } from './resource-resolver.mjs';
export { workflowResourceBase } from './resource-resolver.mjs';

/**
 * Canonical output.schema path resolution used by both runtime validation and
 * prompt rendering. All relative refs use one base only: the directory
 * containing the active workflow file. Reusable shared resources must be
 * referenced with explicit workflow-relative traversal such as
 * `../../shared/...`; there is no repository-root or `shared/...` alias.
 */
function outputSchemaError(messagePrefix, message) {
  return new WorkflowRuntimeError(`${messagePrefix}: ${message}`);
}

const outputSchemaCache = new Map();

function fileCacheSignature(filePath) {
  const stats = statSync(filePath);
  return `${stats.dev}:${stats.ino}:${stats.ctimeMs}:${stats.mtimeMs}:${stats.size}`;
}

function readOutputSchemaJson(schemaPath, schemaRef, messagePrefix) {
  const signature = fileCacheSignature(schemaPath);
  const cached = outputSchemaCache.get(schemaPath);
  if (cached?.signature === signature) return cached.schema;
  try {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    outputSchemaCache.set(schemaPath, { signature, schema });
    return schema;
  } catch (error) {
    throw outputSchemaError(messagePrefix, `invalid output schema JSON '${schemaRef}': ${error.message}`);
  }
}

export function resolveOutputSchemaPath({
  workflow,
  workflowPath,
  schemaRef,
  repositoryRoot,
  messagePrefix = 'output schema validation failed',
}) {
  return resolveWorkflowFileRef({
    workflowPath,
    fileRef: schemaRef,
    fieldName: 'output',
    kind: 'schema',
    messagePrefix,
    repositoryRoot,
    missingMessage: `${messagePrefix}: output.schema not found: ${schemaRef}`,
  });
}

export function loadOutputSchema({
  workflow,
  workflowPath,
  schemaRef,
  repositoryRoot,
  messagePrefix = 'output schema validation failed',
}) {
  const schemaPath = resolveOutputSchemaPath({ workflow, workflowPath, schemaRef, repositoryRoot, messagePrefix });
  return { schema: readOutputSchemaJson(schemaPath, schemaRef, messagePrefix), schemaPath };
}
