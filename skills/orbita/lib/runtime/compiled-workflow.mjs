import { validateWorkflowDocument } from '../entities/Workflow/index.mjs';
import { workflowSemanticValidationOptions } from './workflow-semantic-validation.mjs';
import { deepFreeze, ownedSnapshot } from './owned-snapshot.mjs';

const COMPILED_WORKFLOW = Symbol('orbita.compiledWorkflow');
function canonicalize(value, seen = new WeakSet()) {
  if (value === undefined) return ['undefined'];
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) throw new TypeError('semantic validation inputs must not contain cycles');
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map((entry) => canonicalize(entry, seen));
    if (Object.hasOwn(value, 'loaded')) result = { values: result, loaded: value.loaded };
  } else if (value instanceof Map) {
    result = [...value.entries()]
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([key, entry]) => [key, canonicalize(entry, seen)]);
  } else {
    result = Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key], seen)]));
  }
  seen.delete(value);
  return result;
}

function contentSignature(value) {
  return JSON.stringify(canonicalize(value));
}

function allowedRolesKey(allowedRoles) {
  if (!Array.isArray(allowedRoles)) return String(allowedRoles);
  const loaded = allowedRoles.loaded === false ? 'unloaded' : 'loaded';
  return `${loaded}:${allowedRoles.join('\u001e')}`;
}

function outputSchemasKey(outputSchemas) {
  return contentSignature(outputSchemas ?? null);
}

function semanticInputs(options = {}) {
  return {
    allowedRoles: allowedRolesKey(options.allowedRoles),
    outputSchemas: outputSchemasKey(options.outputSchemas),
    externalSchemas: contentSignature(options.externalSchemas ?? []),
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
  const workflowSnapshot = structuredClone(workflow);
  const validationOptions = workflowSemanticValidationOptions(options);
  const ownedValidationOptions = ownedSnapshot(validationOptions);
  validateWorkflowDocument(workflowSnapshot, ownedValidationOptions);
  Object.defineProperty(workflowSnapshot, COMPILED_WORKFLOW, {
    value: { inputs },
    enumerable: false,
    configurable: false,
  });
  return deepFreeze(workflowSnapshot);
}

export function isCompiledWorkflowForRuntime(workflow, options = {}) {
  return Boolean(
    workflow
    && typeof workflow === 'object'
    && workflow[COMPILED_WORKFLOW]
    && sameSemanticInputs(workflow[COMPILED_WORKFLOW].inputs, semanticInputs(options)),
  );
}
