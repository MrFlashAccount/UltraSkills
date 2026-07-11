/**
 * Workflow entity owns workflow-level validation, topology, step lookup, and cursor inference.
 * It accepts boundary DTO data and never reads files or parses CLI arguments.
 */
import { WorkflowRuntimeError } from '../../errors.mjs';
import { parsePathExpression } from '../../runtime/expression.mjs';
import { normalizePromptText } from '../../runtime/prompt-text.mjs';
import { extractPromptInterpolations } from '../../runtime/prompt-interpolation.mjs';
import { assertRoleDirectoryName } from '../../runtime/role-ref.mjs';
import { RESERVED_STATE_KEYS, DANGEROUS_OBJECT_KEYS, isDangerousObjectKey, isReservedStateKey } from '../../runtime/state-keys.mjs';
import { statusForStep } from '../../runtime/step-status.mjs';
import { assertLoopPolicies } from '../../runtime/loop-policies.mjs';
import { assertTransitionDescriptorTargets, normalizeTransitionNext } from '../../runtime/transition-next.mjs';
import { isShardStep } from '../../runtime/shard.mjs';
import { fanoutBranchIdIssues, isFanoutStep } from '../../runtime/fanout.mjs';
import { compileWorkflowOutputSchema } from './schema-ref-validation.mjs';
import { isSafeWorkflowStepId } from '../../runtime/step-id.mjs';
import { deepFreeze } from '../../runtime/owned-snapshot.mjs';

function cloneBoundaryData(dto) {
  return typeof dto?.toJSON === 'function' ? dto.toJSON() : structuredClone(dto);
}

function cloneStepBoundaryData(stepId, step) {
  return structuredClone({ id: stepId, ...step });
}

const WORKFLOW_NAME = /^[a-z][a-z0-9-]*$/;

function fail(message) {
  throw new WorkflowRuntimeError(`workflow semantic validation failed: ${message}`);
}

function fieldPath(...parts) {
  return parts.filter((part) => part !== undefined && part !== '').join('.');
}

function assertWorkflowRootTargets(workflow) {
  const startStep = workflow.steps[workflow.start];
  if (!startStep) fail(`workflow start target not found: ${workflow.start}`);

  const doneStep = workflow.steps[workflow.done];
  if (!doneStep) fail(`workflow done target not found: ${workflow.done}`);
  if (doneStep.kind !== 'done') fail(`workflow done target '${workflow.done}' must be a done step`);
}

function assertWorkflowIdentity(workflow) {
  if (typeof workflow.name !== 'string' || !WORKFLOW_NAME.test(workflow.name)) {
    fail(`workflow name must be a non-empty lowercase kebab-case identifier: ${JSON.stringify(workflow.name)}`);
  }
}

function assertWorkflowStepIds(workflow) {
  for (const stepId of Object.keys(workflow.steps)) {
    if (!isSafeWorkflowStepId(stepId)) {
      fail(`workflow step id '${stepId}' is invalid for runner storage; expected ASCII letters, digits, underscore, hyphen, or period, excluding '.' and '..'`);
    }
    if (isReservedStateKey(stepId)) {
      fail(`workflow step id '${stepId}' is reserved for runtime aggregate state; reserved ids: ${RESERVED_STATE_KEYS.join(', ')}`);
    }
    if (isDangerousObjectKey(stepId)) {
      fail(`workflow step id '${stepId}' is reserved because it is unsafe as a JavaScript object key; reserved ids: ${DANGEROUS_OBJECT_KEYS.join(', ')}`);
    }
  }
}

function normalizeAllowedRoleCatalog(allowedRoleNames) {
  if (allowedRoleNames === undefined) return { loaded: false, names: [] };
  if (Array.isArray(allowedRoleNames)) return { loaded: allowedRoleNames.loaded !== false, names: allowedRoleNames };
  if (allowedRoleNames && typeof allowedRoleNames === 'object') {
    const names = Array.isArray(allowedRoleNames.names) ? allowedRoleNames.names : [];
    return { loaded: allowedRoleNames.loaded !== false, names };
  }
  return { loaded: true, names: [] };
}

function assertWorkflowStepRoles(workflow, allowedRoleNames) {
  const roleCatalog = normalizeAllowedRoleCatalog(allowedRoleNames);
  const allowedRoles = new Set(roleCatalog.names);
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (step.kind !== 'worker' && !isFanoutStep(step) && !isShardStep(step)) continue;
    const role = step.input?.role;
    if (!role) continue;
    try {
      assertRoleDirectoryName(role);
    } catch (error) {
      if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' ${error.message.replace(/^workflow role validation failed: /, '')}`);
      throw error;
    }
    if (roleCatalog.loaded && !allowedRoles.has(role)) {
      const expected = [...allowedRoles].join(', ');
      fail(`step '${stepId}' input.role '${role}' is not an allowed role${expected ? `; expected one of: ${expected}` : ''}`);
    }
  }
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!isFanoutStep(step)) continue;
    for (const [branchId, branch] of Object.entries(step.branches ?? {})) {
      const role = branch.input?.role;
      if (!role) continue;
      try {
        assertRoleDirectoryName(role);
      } catch (error) {
        if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' fanout branch '${branchId}' ${error.message.replace(/^workflow role validation failed: /, '')}`);
        throw error;
      }
      if (roleCatalog.loaded && !allowedRoles.has(role)) {
        const expected = [...allowedRoles].join(', ');
        fail(`step '${stepId}' fanout branch '${branchId}' input.role '${role}' is not an allowed role${expected ? `; expected one of: ${expected}` : ''}`);
      }
    }
  }
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!isShardStep(step)) continue;
    const role = step.worker?.input?.role;
    if (!role) continue;
    try {
      assertRoleDirectoryName(role);
    } catch (error) {
      if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' shard.worker ${error.message.replace(/^workflow role validation failed: /, '')}`);
      throw error;
    }
    if (roleCatalog.loaded && !allowedRoles.has(role)) {
      const expected = [...allowedRoles].join(', ');
      fail(`step '${stepId}' shard.worker input.role '${role}' is not an allowed role${expected ? `; expected one of: ${expected}` : ''}`);
    }
  }
}

function isExternalWorkflowOutputSchema(_schemaRef, schema) {
  return typeof schema?.$id === 'string' && schema.$id.includes('/schemas/workflow/dev-harness/');
}

function collectFieldAnnotationWarnings(schema, schemaRef, warnings, pathSegments = []) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;

  const hasFieldNote = typeof schema.description === 'string' || typeof schema['x-usage'] === 'string';
  if (hasFieldNote && pathSegments.length > 0 && typeof schema.description === 'string' && typeof schema['x-usage'] !== 'string') {
    warnings.push(`output.schema '${schemaRef}' field '${fieldPath(...pathSegments)}' has description but no x-usage receiver instruction`);
  }

  if (schema.properties && typeof schema.properties === 'object') {
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      if (propertyName === 'x-usage') continue;
      collectFieldAnnotationWarnings(propertySchema, schemaRef, warnings, [...pathSegments, propertyName]);
    }
  }
  if (schema.$defs && typeof schema.$defs === 'object') {
    for (const [defName, defSchema] of Object.entries(schema.$defs)) {
      collectFieldAnnotationWarnings(defSchema, schemaRef, warnings, [...pathSegments, '$defs', defName]);
    }
  }
  if (schema.items) collectFieldAnnotationWarnings(schema.items, schemaRef, warnings, [...pathSegments, 'items']);
}

function decodeJsonPointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveLocalSchemaRef(rootSchema, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#')) return undefined;
  if (ref === '#') return rootSchema;
  if (!ref.startsWith('#/')) return undefined;

  let current = rootSchema;
  for (const rawSegment of ref.slice(2).split('/')) {
    const segment = decodeJsonPointerSegment(rawSegment);
    if (!current || typeof current !== 'object' || Array.isArray(current) || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function normalizeSchemaForSemanticIntrospection(schema, rootSchema = schema, refStack = []) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;

  let baseSchema = {};
  if (typeof schema.$ref === 'string') {
    if (refStack.includes(schema.$ref)) {
      fail(`output.schema contains circular local $ref: ${[...refStack, schema.$ref].join(' -> ')}`);
    }
    const resolved = resolveLocalSchemaRef(rootSchema, schema.$ref);
    if (resolved) {
      baseSchema = normalizeSchemaForSemanticIntrospection(resolved, rootSchema, [...refStack, schema.$ref]);
    }
  }

  const normalized = { ...baseSchema };
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$ref') continue;
    if (Array.isArray(value)) {
      normalized[key] = value.map((item) => normalizeSchemaForSemanticIntrospection(item, rootSchema, refStack));
    } else if (value && typeof value === 'object') {
      const objectValue = {};
      for (const [childKey, childValue] of Object.entries(value)) {
        objectValue[childKey] = normalizeSchemaForSemanticIntrospection(childValue, rootSchema, refStack);
      }
      normalized[key] = objectValue;
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

function validateOutputSchemaDocument(schema, schemaRef, workflow, _runtimeContext, warnings, { stepId, step, requireWorkerOutcomeContract = true, externalSchemas = [] } = {}) {
  let validation;
  try {
    validation = compileWorkflowOutputSchema(schema, { externalSchemas });
  } catch (error) {
    fail(`output.schema '${schemaRef}' is not a valid JSON Schema: ${error.message}`);
  }
  // Validation result is irrelevant here: compiling the schema is the check.
  void validation;

  const normalizedSchema = normalizeSchemaForSemanticIntrospection(schema);
  if (requireWorkerOutcomeContract && ['worker', 'fanout', 'shard'].includes(step?.kind)) assertWorkerOutputContract({ stepId, schema: normalizedSchema });
  if (isExternalWorkflowOutputSchema(schemaRef, schema)) collectFieldAnnotationWarnings(schema, schemaRef, warnings);
  return normalizedSchema;
}

function outputSchemaForProducer(outputSchemas, producerKey, schemaRef) {
  const loaded = outputSchemas instanceof Map
    ? outputSchemas.get(producerKey) ?? outputSchemas.get(schemaRef)
    : outputSchemas?.[producerKey] ?? outputSchemas?.[schemaRef];
  return loaded?.schema ?? loaded;
}

function normalizeStepOutputSchemas({ workflow, outputSchemas = new Map(), warnings, requireSchemaPresence = true, requireWorkerOutcomeContract = true, externalSchemas = [] }) {
  const schemasByStep = new Map();
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    const schemaRef = step.output?.schema;
    if (!schemaRef) continue;
    const schema = outputSchemaForProducer(outputSchemas, stepId, schemaRef);
    if (!schema) {
      if (requireSchemaPresence) fail(`step '${stepId}' output.schema '${schemaRef}' was not provided to Workflow.validate()`);
      continue;
    }
    const normalizedSchema = validateOutputSchemaDocument(schema, schemaRef, workflow, undefined, warnings, { stepId, step, requireWorkerOutcomeContract, externalSchemas });
    schemasByStep.set(stepId, normalizedSchema);
  }
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!isShardStep(step)) continue;
    const schemaRef = step.worker?.output?.schema;
    if (!schemaRef) continue;
    const producerKey = `${stepId}.worker`;
    const loadedSchema = outputSchemaForProducer(outputSchemas, producerKey, schemaRef);
    if (!loadedSchema) {
      if (requireSchemaPresence) fail(`step '${stepId}' shard.worker output.schema '${schemaRef}' was not provided to Workflow.validate()`);
      continue;
    }
    validateOutputSchemaDocument(loadedSchema, schemaRef, workflow, undefined, warnings, {
      stepId,
      step: { kind: 'worker' },
      requireWorkerOutcomeContract,
      externalSchemas,
    });
  }
  for (const [ownerStepId, step] of Object.entries(workflow.steps)) {
    if (!isFanoutStep(step)) continue;
    for (const [branchId, branch] of Object.entries(step.branches ?? {})) {
      const schemaRef = branch.output?.schema;
      if (!schemaRef) continue;
      const producerKey = `${ownerStepId}.branches.${branchId}`;
      const loadedSchema = outputSchemaForProducer(outputSchemas, producerKey, schemaRef);
      if (!loadedSchema) {
        if (requireSchemaPresence) fail(`step '${ownerStepId}' fanout branch '${branchId}' output.schema '${schemaRef}' was not provided to Workflow.validate()`);
        continue;
      }
      const normalizedSchema = validateOutputSchemaDocument(loadedSchema, schemaRef, workflow, undefined, warnings, {
        stepId: branchId,
        step: { kind: 'worker' },
        requireWorkerOutcomeContract,
        externalSchemas,
      });
      schemasByStep.set(branchId, normalizedSchema);
    }
  }
  return schemasByStep;
}

function schemaRequiresPath(schema, pathSegments) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
  if (pathSegments.length === 0) return true;
  const [segment, ...rest] = pathSegments;

  const propertySchema = schema.properties && typeof schema.properties === 'object'
    ? schema.properties[segment]
    : undefined;
  const directRequired = Array.isArray(schema.required)
    && schema.required.includes(segment)
    && (rest.length === 0 || (propertySchema && schemaRequiresPath(propertySchema, rest)));

  const allOfRequired = Array.isArray(schema.allOf) && schema.allOf.some((item) => schemaRequiresPath(item, pathSegments));
  const oneOfRequired = Array.isArray(schema.oneOf) && schema.oneOf.length > 0 && schema.oneOf.every((item) => schemaRequiresPath(item, pathSegments));
  const anyOfRequired = Array.isArray(schema.anyOf) && schema.anyOf.length > 0 && schema.anyOf.every((item) => schemaRequiresPath(item, pathSegments));

  return directRequired || allOfRequired || oneOfRequired || anyOfRequired;
}

function schemaAllowsNonString(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return true;
  if (schema.const !== undefined) return typeof schema.const !== 'string';
  if (Array.isArray(schema.enum)) return schema.enum.some((value) => typeof value !== 'string');
  if (schema.type !== undefined) {
    if (schema.type === 'string') return false;
    if (Array.isArray(schema.type)) return schema.type.some((type) => type !== 'string');
    return true;
  }
  if (Array.isArray(schema.allOf)) return schema.allOf.every((item) => schemaAllowsNonString(item));
  if (Array.isArray(schema.oneOf)) return schema.oneOf.some((item) => schemaAllowsNonString(item));
  if (Array.isArray(schema.anyOf)) return schema.anyOf.some((item) => schemaAllowsNonString(item));
  return true;
}

function assertSchemaRequiresExpressionPath({ stepId, expression, field, rootSchema, pathSegments = expression.path }) {
  if (!schemaRequiresPath(rootSchema, pathSegments) && !recoverableBlockedVariantAllowsMissingPath(rootSchema, pathSegments)) {
    fail(`step '${stepId}' ${field} expression ${expression.source} must reference a required output.schema path`);
  }
}

function branchRequiresPathForDiscriminatorValue(rootSchema, discriminator, value, pathSegments) {
  if (!Array.isArray(rootSchema?.allOf)) return false;
  return rootSchema.allOf.some((branch) => {
    const branchValue = branch?.if?.properties?.[discriminator]?.const;
    return branchValue === value && schemaRequiresPath(branch.then, pathSegments);
  });
}

function recoverableBlockedVariantAllowsMissingPath(rootSchema, pathSegments) {
  if (pathSegments.length === 0) return false;

  for (const discriminator of ['outcome', 'approval']) {
    const values = collectStringValues({ anyOf: schemaForPath(rootSchema, [discriminator]) });
    if (!values.has('blocked')) continue;

    const nonBlockedValues = [...values].filter((value) => value !== 'blocked');
    if (nonBlockedValues.length === 0) continue;
    if (nonBlockedValues.every((value) => branchRequiresPathForDiscriminatorValue(rootSchema, discriminator, value, pathSegments))) {
      return true;
    }
  }

  return false;
}

function assertWorkerOutputContract({ stepId, schema }) {
  if (!schemaRequiresPath(schema, ['outcome'])) {
    fail(`step '${stepId}' output.schema must require string field 'outcome' for worker outputs`);
  }
  const outcomeSchemas = schemaForPath(schema, ['outcome']);
  if (outcomeSchemas.length === 0 || outcomeSchemas.some((outcomeSchema) => schemaAllowsNonString(outcomeSchema))) {
    fail(`step '${stepId}' output.schema field 'outcome' must allow only strings`);
  }
}

function schemaVariants(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [];
  const variants = [schema];
  for (const key of ['oneOf', 'anyOf', 'allOf']) {
    if (Array.isArray(schema[key])) variants.push(...schema[key].flatMap((item) => schemaVariants(item)));
  }
  return variants;
}

function schemaForPath(schema, pathSegments) {
  let candidates = [schema];
  for (const segment of pathSegments) {
    const nextCandidates = [];
    for (const candidate of candidates.flatMap((item) => schemaVariants(item))) {
      const propertySchema = candidate?.properties?.[segment];
      if (propertySchema) nextCandidates.push(propertySchema);
    }
    candidates = nextCandidates;
    if (candidates.length === 0) return [];
  }
  return candidates.flatMap((item) => schemaVariants(item));
}

function schemaRootsForPath(schema, pathSegments) {
  let candidates = [schema];
  for (const segment of pathSegments) {
    candidates = candidates
      .flatMap((item) => schemaVariants(item))
      .map((candidate) => candidate?.properties?.[segment])
      .filter(Boolean);
    if (candidates.length === 0) return [];
  }
  return candidates;
}

function schemaAllowsNonArray(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return true;
  if (schema.type !== undefined) {
    if (schema.type === 'array') return false;
    if (Array.isArray(schema.type)) return schema.type.some((type) => type !== 'array');
    return true;
  }
  if (schema.items !== undefined) return false;
  if (Array.isArray(schema.allOf)) return schema.allOf.every((item) => schemaAllowsNonArray(item));
  if (Array.isArray(schema.oneOf)) return schema.oneOf.some((item) => schemaAllowsNonArray(item));
  if (Array.isArray(schema.anyOf)) return schema.anyOf.some((item) => schemaAllowsNonArray(item));
  return true;
}


function mergeSelectorAnalysis(target, source) {
  for (const value of source.directValues) target.directValues.add(value);
  for (const value of source.itemValues) target.itemValues.add(value);
  target.arraySchemas.push(...source.arraySchemas);
  return target;
}

function selectorAnalysis({ directValues = new Set(), itemValues = new Set(), arraySchemas = [] } = {}) {
  return { directValues, itemValues, arraySchemas };
}

function assertClosedStringValueSchema(schema, errorContext) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    fail(`${errorContext} must resolve from a closed string enum/const schema`);
  }
  if (schema.const !== undefined) {
    if (typeof schema.const !== 'string') fail(`${errorContext} schema allows non-string value ${JSON.stringify(schema.const)}`);
    return selectorAnalysis({ directValues: new Set([schema.const]) });
  }
  if (Array.isArray(schema.enum)) {
    if (schema.enum.length === 0) fail(`${errorContext} enum schema must declare at least one string value`);
    for (const value of schema.enum) {
      if (typeof value !== 'string') fail(`${errorContext} schema allows non-string value ${JSON.stringify(value)}`);
    }
    return selectorAnalysis({ directValues: new Set(schema.enum) });
  }
  if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf)) {
    const variants = schema.anyOf ?? schema.oneOf;
    if (variants.length === 0) fail(`${errorContext} union schema must declare at least one closed string enum/const branch`);
    return variants.reduce((acc, variant) => mergeSelectorAnalysis(acc, assertClosedStringValueSchema(variant, errorContext)), selectorAnalysis());
  }
  if (Array.isArray(schema.allOf)) {
    const finiteBranches = schema.allOf
      .map((variant) => {
        try {
          return assertClosedStringValueSchema(variant, errorContext);
        } catch (error) {
          if (error instanceof WorkflowRuntimeError && /open string schema|must resolve from a closed string enum\/const schema/.test(error.message)) return undefined;
          throw error;
        }
      })
      .filter(Boolean);
    if (finiteBranches.length === 0) fail(`${errorContext} must resolve from a closed string enum/const schema`);
    return finiteBranches.reduce((acc, branch) => mergeSelectorAnalysis(acc, branch), selectorAnalysis());
  }
  if (schema.type === 'string' || (Array.isArray(schema.type) && schema.type.includes('string'))) {
    fail(`${errorContext} open string schema must be constrained with enum or const values`);
  }
  if (schema.type !== undefined) fail(`${errorContext} schema allows non-string type ${JSON.stringify(schema.type)}`);
  fail(`${errorContext} must resolve from a closed string enum/const schema`);
}

function assertClosedDynamicTargetSchema(schema, errorContext) {
  return assertClosedStringValueSchema(schema, errorContext);
}

function collectStringValues(schema, values = new Set()) {
  for (const candidate of schemaVariants(schema)) {
    if (typeof candidate.const === 'string') values.add(candidate.const);
    if (Array.isArray(candidate.enum)) {
      for (const value of candidate.enum) if (typeof value === 'string') values.add(value);
    }
  }
  return values;
}

function possibleStringTargetsForSchema(schema) {
  const directValues = collectStringValues(schema);
  const itemValues = new Set();
  const arraySchemas = [];
  for (const candidate of schemaVariants(schema)) {
    if (candidate.type === 'array' || candidate.items) {
      arraySchemas.push(candidate);
      collectStringValues(candidate.items, itemValues);
    }
  }

  return { directValues, itemValues, arraySchemas, possible: new Set([...directValues, ...itemValues]) };
}

function schemaForExpression({ workflow, schemasByStep, stepId, step, expression }) {
  if (expression.root === 'output') {
    const schema = schemasByStep.get(stepId);
    if (!schema) return { schema: undefined, reason: `step '${stepId}' has no output.schema for ${expression.source}` };
    return { schema: schemaForPath(schema, expression.path), rootSchema: schema, requiredPath: expression.path, reason: undefined };
  }

  const [stateKey, ...rest] = expression.path;
  if (!Object.hasOwn(workflow.steps, stateKey) && !schemasByStep.has(stateKey)) return { schema: undefined, reason: `input step or fanout branch '${stateKey}' is not declared for ${expression.source}` };
  const producerSchema = schemasByStep.get(stateKey);
  if (!producerSchema) return { schema: undefined, reason: `input step '${stateKey}' has no output.schema for ${expression.source}` };
  return { schema: schemaForPath(producerSchema, rest), rootSchema: producerSchema, requiredPath: rest, reason: undefined };
}

function approvalOutputExpressionMayBeUnchecked({ schemasByStep, stepId, step, expression }) {
  return step.kind === 'approval' && expression.root === 'output' && !schemasByStep.has(stepId);
}

function assertExpressionSchemaAvailable({ workflow, schemasByStep, stepId, step, expression, field, requireSchemaCoverage = true }) {
  const resolved = schemaForExpression({ workflow, schemasByStep, stepId, step, expression });
  if (!resolved.schema || resolved.schema.length === 0) {
    if (!requireSchemaCoverage) return undefined;
    if (approvalOutputExpressionMayBeUnchecked({ schemasByStep, stepId, step, expression })) return undefined;
    fail(`step '${stepId}' ${field} expression ${expression.source} has no schema-covered path (${resolved.reason ?? 'path not found'})`);
  }
  return resolved;
}

function assertDynamicTargetSchema({ workflow, schemasByStep, stepId, step, expression, field, requireSchemaCoverage = true, requireExpressionRequiredPaths = true, allowOpenTransitionSchemas = false }) {
  const resolved = assertExpressionSchemaAvailable({ workflow, schemasByStep, stepId, step, expression, field, requireSchemaCoverage });
  if (!resolved) return;
  if (requireExpressionRequiredPaths) assertSchemaRequiresExpressionPath({ stepId, expression, field, rootSchema: resolved.rootSchema, pathSegments: resolved.requiredPath });
  let aggregate;
  try {
    aggregate = resolved.schema.reduce((acc, schema) => mergeSelectorAnalysis(acc, assertClosedDynamicTargetSchema(schema, `step '${stepId}' ${field} expression ${expression.source}`)), selectorAnalysis());
  } catch (error) {
    if (allowOpenTransitionSchemas && error instanceof WorkflowRuntimeError) return undefined;
    throw error;
  }

  if (recoverableBlockedOutputSelector(step, expression)) aggregate.directValues.delete('blocked');
  for (const target of aggregate.directValues) {
    if (!Object.hasOwn(workflow.steps, target)) fail(`step '${stepId}' ${field} expression ${expression.source} schema allows unknown target '${target}'`);
  }
  return aggregate;
}

function assertMatchCasesSchema({ workflow, schemasByStep, stepId, step, descriptor, field, requireSchemaCoverage = true, requireExpressionRequiredPaths = true, allowUnreachableCases = false, allowOpenTransitionSchemas = false }) {
  const resolved = assertExpressionSchemaAvailable({ workflow, schemasByStep, stepId, step, expression: descriptor.expression, field, requireSchemaCoverage });
  if (!resolved) return;
  if (requireExpressionRequiredPaths) assertSchemaRequiresExpressionPath({ stepId, expression: descriptor.expression, field: `${field}.match`, rootSchema: resolved.rootSchema, pathSegments: resolved.requiredPath });
  let possibleCaseKeys;
  try {
    const aggregate = resolved.schema.reduce((acc, schema) => mergeSelectorAnalysis(acc, assertClosedStringValueSchema(schema, `step '${stepId}' ${field}.match expression ${descriptor.expression.source}`)), selectorAnalysis());
    possibleCaseKeys = aggregate.directValues;
  } catch (error) {
    if (allowOpenTransitionSchemas && error instanceof WorkflowRuntimeError) return undefined;
    throw error;
  }
  const transitionCaseKeys = recoverableBlockedOutputSelector(step, descriptor.expression)
    ? new Set([...possibleCaseKeys].filter((key) => key !== 'blocked'))
    : possibleCaseKeys;
  for (const key of transitionCaseKeys) {
    if (!Object.hasOwn(descriptor.cases, key)) fail(`step '${stepId}' ${field}.cases is missing schema-declared case '${key}'`);
  }
  if (!allowUnreachableCases) {
    for (const key of Object.keys(descriptor.cases)) {
      if (!transitionCaseKeys.has(key)) fail(`step '${stepId}' ${field}.cases declares unreachable case '${key}' not present in the selector schema`);
    }
  }

  return transitionCaseKeys;
}

function recoverableBlockedOutputSelector(step, expression) {
  return expression?.root === 'output' &&
    expression.path?.length === 1 &&
    ((step.kind === 'worker' && expression.path[0] === 'outcome') ||
      (step.kind === 'approval' && expression.path[0] === 'approval'));
}

function targetSetsForMatchCases(possibleCaseKeys, cases) {
  return [...possibleCaseKeys].map((key) => [cases[key]]);
}

function targetSetsForDynamicTarget(aggregate) {
  return [...aggregate.directValues].map((target) => [target]);
}

function assertTransitionSemantics(workflow, schemasByStep, { requireSchemaCoverage = true, requireExpressionRequiredPaths = true, allowUnreachableCases = false, allowOpenTransitionSchemas = false } = {}) {
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!Object.hasOwn(step, 'next')) continue;
    let descriptor;
    try {
      descriptor = normalizeTransitionNext(step.next);
      assertTransitionDescriptorTargets(workflow, stepId, descriptor);
    } catch (error) {
      if (error instanceof WorkflowRuntimeError) fail(error.message);
      throw error;
    }

    if (descriptor.kind === 'dynamic-target') {
      assertDynamicTargetSchema({ workflow, schemasByStep, stepId, step, expression: descriptor.expression, field: 'next', requireSchemaCoverage, requireExpressionRequiredPaths, allowOpenTransitionSchemas });
      continue;
    }
    if (descriptor.kind === 'match-cases') {
      assertMatchCasesSchema({ workflow, schemasByStep, stepId, step, descriptor, field: 'next', requireSchemaCoverage, requireExpressionRequiredPaths, allowUnreachableCases, allowOpenTransitionSchemas });
      continue;
    }
  }
}

function edgeRows(stepId, targetSets) {
  const rows = [];
  for (const targets of targetSets) {
    const fanout = targets.length > 1;
    for (const target of targets) rows.push({ from: stepId, to: target, fanout });
  }
  return rows;
}

function collectExpandedRouteGraphEdges(workflow, schemasByStep, { requireSchemaCoverage = true, requireExpressionRequiredPaths = true, allowUnreachableCases = false } = {}) {
  const edges = [];
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!Object.hasOwn(step, 'next')) continue;
    const descriptor = normalizeTransitionNext(step.next);

    if (descriptor.kind === 'static-target') {
      edges.push({ from: stepId, to: descriptor.target, fanout: false });
      continue;
    }
    if (descriptor.kind === 'dynamic-target') {
      const aggregate = assertDynamicTargetSchema({ workflow, schemasByStep, stepId, step, expression: descriptor.expression, field: 'next', requireSchemaCoverage, requireExpressionRequiredPaths });
      if (aggregate) edges.push(...edgeRows(stepId, targetSetsForDynamicTarget(aggregate)));
      continue;
    }
    if (descriptor.kind === 'match-cases') {
      const possibleCaseKeys = assertMatchCasesSchema({ workflow, schemasByStep, stepId, step, descriptor, field: 'next', requireSchemaCoverage, requireExpressionRequiredPaths, allowUnreachableCases });
      if (possibleCaseKeys) edges.push(...edgeRows(stepId, targetSetsForMatchCases(possibleCaseKeys, descriptor.cases)));
      continue;
    }

  }
  return edges;
}

function assertWorkflowShardPolicies(workflow, schemasByStep) {
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!isShardStep(step)) continue;
    const shards = step.input?.shards;
    if (!Array.isArray(shards)) {
      let expression;
      try {
        expression = parsePathExpression(shards);
      } catch (error) {
        if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' shard input.shards ${error.message}`);
        throw error;
      }
      if (expression.root !== 'input') fail(`step '${stepId}' shard input.shards must use input.* selector`);
      const resolved = assertExpressionSchemaAvailable({
        workflow,
        schemasByStep,
        stepId,
        step,
        expression,
        field: 'shard input.shards',
        requireSchemaCoverage: true,
      });
      assertSchemaRequiresExpressionPath({
        stepId,
        expression,
        field: 'shard input.shards',
        rootSchema: resolved.rootSchema,
        pathSegments: resolved.requiredPath,
      });
      const arraySchemas = resolved.schema.flatMap((schema) => schemaVariants(schema))
        .filter((schema) => schema?.type === 'array' || schema?.items);
      if (arraySchemas.length === 0) fail(`step '${stepId}' shard input.shards expression ${expression.source} must resolve to an array schema`);
      for (const schema of arraySchemas) {
        if (schema.minItems === undefined || schema.minItems < 1) {
          fail(`step '${stepId}' shard input.shards expression ${expression.source} array schema must declare minItems >= 1`);
        }
      }
    }
  }
}

function fanoutSelectionExpressions(selection) {
  if (typeof selection === 'string') return [selection];
  if (selection && typeof selection === 'object' && !Array.isArray(selection) && Array.isArray(selection.first_of)) {
    return selection.first_of;
  }
  return [];
}

function assertFanoutSelectionSchema({ workflow, schemasByStep, stepId, step, expressionSource, requirePath = false }) {
  let expression;
  try {
    expression = parsePathExpression(expressionSource);
  } catch (error) {
    if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' fanout input.branches ${error.message}`);
    throw error;
  }
  if (expression.root !== 'input') fail(`step '${stepId}' fanout input.branches must use input.* selector`);
  const resolved = assertExpressionSchemaAvailable({
    workflow,
    schemasByStep,
    stepId,
    step,
    expression,
    field: 'fanout input.branches',
    requireSchemaCoverage: true,
  });
  if (requirePath) {
    assertSchemaRequiresExpressionPath({
      stepId,
      expression,
      field: 'fanout input.branches',
      rootSchema: resolved.rootSchema,
      pathSegments: resolved.requiredPath,
    });
  }

  const selectorSchemas = schemaRootsForPath(resolved.rootSchema, resolved.requiredPath);
  if (selectorSchemas.length === 0 || selectorSchemas.some((schema) => schemaAllowsNonArray(schema))) {
    fail(`step '${stepId}' fanout input.branches expression ${expression.source} must resolve only to array schemas`);
  }

  const arraySchemas = resolved.schema.flatMap((schema) => schemaVariants(schema))
    .filter((schema) => schema?.type === 'array' || schema?.items);
  if (arraySchemas.length === 0) fail(`step '${stepId}' fanout input.branches expression ${expression.source} must resolve to an array schema`);
  const allowed = new Set(Object.keys(step.branches));
  for (const schema of arraySchemas) {
    if (schema.minItems === undefined || schema.minItems < 1) {
      fail(`step '${stepId}' fanout input.branches expression ${expression.source} array schema must declare minItems >= 1`);
    }
    if (schema.uniqueItems !== true) {
      fail(`step '${stepId}' fanout input.branches expression ${expression.source} array schema must declare uniqueItems: true`);
    }
    const itemAnalysis = assertClosedStringValueSchema(schema.items, `step '${stepId}' fanout input.branches expression ${expression.source} array item`);
    for (const branchId of itemAnalysis.directValues) {
      if (!allowed.has(branchId)) fail(`step '${stepId}' fanout input.branches expression ${expression.source} schema allows unknown branch '${branchId}'`);
    }
  }
}

function assertWorkflowFanoutPolicies(workflow, schemasByStep) {
  for (const issue of fanoutBranchIdIssues(workflow)) fail(issue);

  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!isFanoutStep(step)) continue;
    const selection = step.input?.branches;
    if (Array.isArray(selection)) {
      const seen = new Set();
      for (const branchId of selection) {
        if (!Object.hasOwn(step.branches, branchId)) fail(`step '${stepId}' fanout input.branches references unknown branch '${branchId}'`);
        if (seen.has(branchId)) fail(`step '${stepId}' fanout input.branches includes duplicate branch '${branchId}'`);
        seen.add(branchId);
      }
    }
    const selectionExpressions = fanoutSelectionExpressions(selection);
    for (const expressionSource of selectionExpressions) {
      assertFanoutSelectionSchema({
        workflow,
        schemasByStep,
        stepId,
        step,
        expressionSource,
        requirePath: typeof selection === 'string',
      });
    }
  }
}

function assertShardPromptPath(stepId, interpolation) {
  const [field, ...nested] = interpolation.expression.path;
  if (!['value', 'index', 'total'].includes(field)) {
    fail(`step '${stepId}' shard.worker.input.prompt supports shard.value, shard.index, or shard.total`);
  }
  if (field !== 'value' && nested.length > 0) fail(`step '${stepId}' shard.worker.input.prompt cannot read a nested path below shard.${field}`);
}

function assertPromptExpressionSemantics(workflow, schemasByStep, { requireSchemaCoverage = true } = {}) {
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    const prompt = normalizePromptText(step.input?.prompt, { fieldName: `steps.${stepId}.input.prompt` });
    let interpolations;
    try {
      interpolations = extractPromptInterpolations(prompt);
    } catch (error) {
      if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' input.prompt ${error.message}`);
      throw error;
    }

    for (const interpolation of interpolations) {
      if (interpolation.expression.root === 'shard') {
        fail(`step '${stepId}' input.prompt may use shard.* only inside shard.worker.input.prompt`);
      }
      assertExpressionSchemaAvailable({
        workflow,
        schemasByStep,
        stepId,
        step,
        expression: interpolation.expression,
        field: 'input.prompt',
        requireSchemaCoverage,
      });
    }

    if (isShardStep(step)) {
      const shardPrompt = normalizePromptText(step.worker?.input?.prompt, { fieldName: `steps.${stepId}.worker.input.prompt` });
      let shardInterpolations;
      try {
        shardInterpolations = extractPromptInterpolations(shardPrompt);
      } catch (error) {
        if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' shard.worker.input.prompt ${error.message}`);
        throw error;
      }
      for (const interpolation of shardInterpolations) {
        if (interpolation.expression.root === 'shard') {
          assertShardPromptPath(stepId, interpolation);
          continue;
        }
        assertExpressionSchemaAvailable({
          workflow,
          schemasByStep,
          stepId,
          step,
          expression: interpolation.expression,
          field: 'shard.worker.input.prompt',
          requireSchemaCoverage,
        });
      }
    }
    if (isFanoutStep(step)) {
      for (const [branchId, branch] of Object.entries(step.branches ?? {})) {
        const branchPrompt = normalizePromptText(branch.input?.prompt, { fieldName: `steps.${stepId}.branches.${branchId}.input.prompt` });
        let branchInterpolations;
        try {
          branchInterpolations = extractPromptInterpolations(branchPrompt);
        } catch (error) {
          if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' fanout branch '${branchId}' input.prompt ${error.message}`);
          throw error;
        }
        for (const interpolation of branchInterpolations) {
          if (interpolation.expression.root === 'shard') {
            fail(`step '${stepId}' fanout branch '${branchId}' input.prompt may not use shard.*`);
          }
          assertExpressionSchemaAvailable({
            workflow,
            schemasByStep,
            stepId: branchId,
            step: branch,
            expression: interpolation.expression,
            field: `fanout branch '${branchId}' input.prompt`,
            requireSchemaCoverage,
          });
        }
      }
    }
  }
}

function validateWorkflowDocument(workflow, options = {}) {
  assertWorkflowIdentity(workflow);
  assertWorkflowStepIds(workflow);
  assertWorkflowRootTargets(workflow);
  assertWorkflowStepRoles(workflow, options.allowedRoles);
  const warnings = [];
  const schemasByStep = normalizeStepOutputSchemas({
    workflow,
    outputSchemas: options.outputSchemas,
    warnings,
    requireSchemaPresence: options.requireSchemaPresence ?? true,
    requireWorkerOutcomeContract: options.requireWorkerOutcomeContract ?? true,
    externalSchemas: options.externalSchemas ?? [],
  });
  assertWorkflowShardPolicies(workflow, schemasByStep);
  assertWorkflowFanoutPolicies(workflow, schemasByStep);
  assertTransitionSemantics(workflow, schemasByStep, {
    requireSchemaCoverage: options.requireSchemaCoverage ?? true,
    requireExpressionRequiredPaths: options.requireExpressionRequiredPaths ?? true,
    allowUnreachableCases: options.allowUnreachableCases ?? false,
    allowOpenTransitionSchemas: options.allowOpenTransitionSchemas ?? false,
  });
  if (workflow.loopPolicies !== undefined) {
    assertLoopPolicies(workflow, collectExpandedRouteGraphEdges(workflow, schemasByStep, {
      requireSchemaCoverage: options.requireSchemaCoverage ?? true,
      requireExpressionRequiredPaths: options.requireExpressionRequiredPaths ?? true,
      allowUnreachableCases: options.allowUnreachableCases ?? false,
    }));
  }
  assertPromptExpressionSemantics(workflow, schemasByStep, {
    requireSchemaCoverage: options.requireSchemaCoverage ?? true,
  });
  const result = { ok: true, workflow: workflow.name, steps: Object.keys(workflow.steps).length };
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}


export class Workflow {
  constructor(workflowData) {
    this.data = cloneBoundaryData(workflowData);
    this.steps = this.data.steps ?? {};
    deepFreeze(this.data);
  }

  toJSON() {
    return structuredClone(this.data);
  }

  validate(options = {}) {
    return validateWorkflowDocument(this.toJSON(), options);
  }

  validateStaticTransitions() {
    for (const [stepId, step] of Object.entries(this.data.steps)) {
      if (!Object.hasOwn(step, 'next')) continue;
      assertTransitionDescriptorTargets(this.data, stepId, normalizeTransitionNext(step.next));
    }
    return { ok: true };
  }

  validateOutputSchemas(outputSchemas = new Map(), options = {}) {
    const warnings = [];
    const schemasByStep = normalizeStepOutputSchemas({
      workflow: this.data,
      outputSchemas,
      warnings,
      requireSchemaPresence: options.requireSchemaPresence ?? true,
      requireWorkerOutcomeContract: options.requireWorkerOutcomeContract ?? true,
      externalSchemas: options.externalSchemas ?? [],
    });
    return { ok: true, schemasByStep, warnings };
  }

  getStep(stepId) {
    const step = this.steps[stepId];
    if (!step) throw new WorkflowRuntimeError(`workflow step not found: ${stepId}`);
    return cloneStepBoundaryData(stepId, step);
  }

  hasStep(stepId) {
    return Object.hasOwn(this.steps, stepId);
  }

  getStartStep() {
    return this.getStep(this.data.start);
  }

  statusForStep(stepId) {
    return statusForStep(this.data, stepId, this.steps[stepId]);
  }

  inferStep(baton) {
    const batonData = typeof baton?.toJSON === 'function' ? baton.toJSON() : baton;
    const stepId = batonData?.cursor;
    if (!this.hasStep(stepId)) throw new WorkflowRuntimeError(`baton cursor not found in workflow: ${stepId}`);
    return this.getStep(stepId);
  }
}

export { validateWorkflowDocument };
