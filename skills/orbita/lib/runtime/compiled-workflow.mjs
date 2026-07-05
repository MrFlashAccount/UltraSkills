import { validateWorkflowDocument } from '../entities/Workflow/index.mjs';
import { workflowSemanticValidationOptions } from './workflow-semantic-validation.mjs';

const COMPILED_WORKFLOW = Symbol('orbita.compiledWorkflow');
const semanticObjectIds = new WeakMap();
let nextSemanticObjectId = 1;

function semanticObjectKey(value) {
  if (!value || typeof value !== 'object') return String(value);
  if (typeof value.$id === 'string' && value.$id.length > 0) return `id:${value.$id}`;
  let id = semanticObjectIds.get(value);
  if (!id) {
    id = nextSemanticObjectId;
    nextSemanticObjectId += 1;
    semanticObjectIds.set(value, id);
  }
  return `object:${id}`;
}

function allowedRolesKey(allowedRoles) {
  if (!Array.isArray(allowedRoles)) return String(allowedRoles);
  const loaded = allowedRoles.loaded === false ? 'unloaded' : 'loaded';
  return `${loaded}:${allowedRoles.join('\u001e')}`;
}

function outputSchemasKey(outputSchemas) {
  if (!outputSchemas) return '';
  const entries = outputSchemas instanceof Map
    ? [...outputSchemas.entries()]
    : Object.entries(outputSchemas);
  return entries
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([key, loaded]) => {
      const schema = loaded?.schema ?? loaded;
      const schemaPath = loaded?.schemaPath ?? '';
      return `${key}:${schemaPath}:${semanticObjectKey(schema)}`;
    })
    .join('\u001f');
}

function semanticInputs(options = {}) {
  return {
    allowedRoles: allowedRolesKey(options.allowedRoles),
    outputSchemas: outputSchemasKey(options.outputSchemas),
    externalSchemas: (options.externalSchemas ?? []).map(semanticObjectKey).join('\u001f'),
  };
}

function sameSemanticInputs(left = {}, right = {}) {
  return left.allowedRoles === right.allowedRoles
    && left.outputSchemas === right.outputSchemas
    && left.externalSchemas === right.externalSchemas;
}

export function compileWorkflowForRuntime(workflow, options = {}) {
  if (isCompiledWorkflowForRuntime(workflow, options)) return workflow;
  const inputs = semanticInputs(options);
  validateWorkflowDocument(workflow, workflowSemanticValidationOptions(options));
  Object.defineProperty(workflow, COMPILED_WORKFLOW, {
    value: { inputs },
    enumerable: false,
    configurable: true,
  });
  return workflow;
}

export function isCompiledWorkflowForRuntime(workflow, options = {}) {
  return Boolean(
    workflow
    && typeof workflow === 'object'
    && workflow[COMPILED_WORKFLOW]
    && sameSemanticInputs(workflow[COMPILED_WORKFLOW].inputs, semanticInputs(options)),
  );
}
