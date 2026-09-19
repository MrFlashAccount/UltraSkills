import { batonSchema } from '../file-contracts/baton/baton-schema.mjs';
import { callFunctionDefinitions } from '../call-functions/registry.mjs';

const WORKFLOW_SEMANTIC_EXTERNAL_SCHEMAS = Object.freeze([batonSchema]);

export function workflowSemanticValidationOptions({
  resources,
  outputSchemas = resources?.outputSchemas,
  allowedRoles = resources?.allowedRoles,
  callFunctions = resources?.callFunctions ?? callFunctionDefinitions,
  externalSchemas = [],
  ...options
} = {}) {
  return {
    ...options,
    outputSchemas,
    allowedRoles,
    callFunctions,
    externalSchemas: [...WORKFLOW_SEMANTIC_EXTERNAL_SCHEMAS, ...externalSchemas],
  };
}

export { WORKFLOW_SEMANTIC_EXTERNAL_SCHEMAS };
