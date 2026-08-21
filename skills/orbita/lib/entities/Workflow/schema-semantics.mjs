/** Schema introspection and output-contract validation for Workflow semantics. */
import { WorkflowRuntimeError } from '../../errors.mjs';
import { isShardStep } from '../../runtime/shard.mjs';
import { isFanoutStep } from '../../runtime/fanout.mjs';
import { compileWorkflowOutputSchema } from './schema-ref-validation.mjs';

const APPROVAL_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  required: ['approval'],
  properties: {
    approval: { enum: ['approved', 'rejected'] },
    feedback: { type: 'string', minLength: 1, maxLength: 4000 },
  },
  additionalProperties: false,
});

function fail(message) {
  throw new WorkflowRuntimeError(`workflow semantic validation failed: ${message}`);
}
function fieldPath(...parts) {
  return parts.map((part) => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
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

function rootSchemaBranches(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [];
  const branches = [schema];
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    for (const branch of schema[keyword] ?? []) branches.push(...rootSchemaBranches(branch));
  }
  for (const keyword of ['if', 'then', 'else']) {
    if (schema[keyword]) branches.push(...rootSchemaBranches(schema[keyword]));
  }
  return branches;
}

function rootPropertyDeclaresStringValue(schema, propertyName, value) {
  return rootSchemaBranches(schema).some((branch) => {
    const propertySchema = branch.properties?.[propertyName];
    return propertySchema?.const === value || (Array.isArray(propertySchema?.enum) && propertySchema.enum.includes(value));
  });
}

function propertySchemasForBranch(branch, propertyName, { includeAdditionalProperties = false } = {}) {
  const propertySchemas = [];
  if (Object.hasOwn(branch.properties ?? {}, propertyName)) propertySchemas.push(branch.properties[propertyName]);

  for (const [pattern, patternSchema] of Object.entries(branch.patternProperties ?? {})) {
    if (new RegExp(pattern, 'u').test(propertyName)) propertySchemas.push(patternSchema);
  }

  if (propertySchemas.length === 0 && includeAdditionalProperties && Object.hasOwn(branch, 'additionalProperties')) {
    propertySchemas.push(branch.additionalProperties);
  }

  if (propertySchemas.length <= 1) return propertySchemas;
  return [{ allOf: propertySchemas }];
}

function rootSchemaDeclaresProperty(schema, propertyName) {
  return rootSchemaBranches(schema).some((branch) => Object.hasOwn(branch.properties ?? {}, propertyName));
}

function assertReservedAggregateOutputFields({ stepId, schema }) {
  for (const field of ['artifacts', 'results']) {
    const required = schemaRequiresPath(schema, [field]);
    const fieldSchemas = rootSchemaBranches(schema)
      .flatMap((branch) => propertySchemasForBranch(branch, field, { includeAdditionalProperties: required }));
    if (!required && fieldSchemas.length === 0) continue;
    if (fieldSchemas.length === 0 || fieldSchemas.some((fieldSchema) => schemaAllowsNonArray(fieldSchema))) {
      fail(`step '${stepId}' output.schema field '${field}' is reserved for runtime aggregate state and must allow only arrays`);
    }
  }
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
  if (
    rootPropertyDeclaresStringValue(normalizedSchema, 'outcome', 'blocked') ||
    rootPropertyDeclaresStringValue(normalizedSchema, 'approval', 'blocked')
  ) {
    fail(`step '${stepId}' output.schema must not declare legacy terminal value 'blocked'; use the runner non-blocking stop control channel`);
  }
  if (rootSchemaDeclaresProperty(normalizedSchema, 'blocker')) {
    fail(`step '${stepId}' output.schema must not declare legacy control field 'blocker'; use the runner non-blocking stop control channel`);
  }
  assertReservedAggregateOutputFields({ stepId, schema: normalizedSchema });
  if (requireWorkerOutcomeContract && ['worker', 'fanout', 'shard'].includes(step?.kind)) assertWorkerOutputContract({ stepId, schema: normalizedSchema });
  if (isExternalWorkflowOutputSchema(schemaRef, schema)) collectFieldAnnotationWarnings(schema, schemaRef, warnings);
  return normalizedSchema;
}

function outputSchemaForStep(outputSchemas, stepId, schemaRef) {
  const loaded = outputSchemas instanceof Map ? outputSchemas.get(stepId) ?? outputSchemas.get(schemaRef) : outputSchemas?.[stepId] ?? outputSchemas?.[schemaRef];
  return loaded?.schema ?? loaded;
}

export function normalizeStepOutputSchemas({ workflow, outputSchemas = new Map(), warnings, requireSchemaPresence = true, requireWorkerOutcomeContract = true, externalSchemas = [] }) {
  const schemasByStep = new Map();
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (step.kind === 'approval') {
      if (step.output !== undefined) fail(`step '${stepId}' approval output is runner-owned; remove output/approvalOutput and use output.approval in next`);
      schemasByStep.set(stepId, APPROVAL_OUTPUT_SCHEMA);
      continue;
    }
    const schemaRef = step.output?.schema;
    if (!schemaRef) continue;
    const schema = outputSchemaForStep(outputSchemas, stepId, schemaRef);
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
    const schema = outputSchemaForStep(outputSchemas, stepId, schemaRef);
    const loadedSchema = schema ?? outputSchemaForStep(outputSchemas, `${stepId}.worker`, schemaRef);
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
      const loadedSchema = outputSchemaForStep(outputSchemas, branchId, schemaRef)
        ?? outputSchemaForStep(outputSchemas, `${ownerStepId}.branches.${branchId}`, schemaRef);
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

function schemaLiteralValues(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return undefined;
  if (Object.hasOwn(schema, 'const')) return [schema.const];
  return Array.isArray(schema.enum) ? schema.enum : undefined;
}

function schemaGuaranteesCondition(schema, condition) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)
    || !condition || typeof condition !== 'object' || Array.isArray(condition)) return false;
  const supportedKeywords = new Set(['properties', 'required', 'type']);
  if (Object.keys(condition).some((keyword) => !supportedKeywords.has(keyword))) return false;
  if (condition.type !== undefined && condition.type !== schema.type) return false;

  const conditionRequired = new Set(condition.required ?? []);
  const schemaRequired = new Set(schema.required ?? []);
  if ([...conditionRequired].some((propertyName) => !schemaRequired.has(propertyName))) return false;

  for (const [propertyName, conditionProperty] of Object.entries(condition.properties ?? {})) {
    if (!conditionRequired.has(propertyName)) return false;
    const schemaValues = schemaLiteralValues(schema.properties?.[propertyName]);
    const conditionValues = schemaLiteralValues(conditionProperty);
    if (!schemaValues || !conditionValues || !schemaValues.every((value) => conditionValues.includes(value))) return false;
  }
  return true;
}

function schemaRequiresPath(schema, pathSegments, guaranteeSchema = schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
  if (pathSegments.length === 0) return true;
  const [segment, ...rest] = pathSegments;

  const propertySchema = schema.properties && typeof schema.properties === 'object'
    ? schema.properties[segment]
    : undefined;
  const nestedPathRequired = rest.length === 0 || (propertySchema && schemaRequiresPath(propertySchema, rest));
  const directRequired = Array.isArray(schema.required)
    && schema.required.includes(segment)
    && nestedPathRequired;

  const allOfRequired = Array.isArray(schema.allOf) && schema.allOf.some((item) => schemaRequiresPath(item, pathSegments, schema));
  const oneOfRequired = Array.isArray(schema.oneOf) && schema.oneOf.length > 0 && schema.oneOf.every((item) => schemaRequiresPath(item, pathSegments));
  const anyOfRequired = Array.isArray(schema.anyOf) && schema.anyOf.length > 0 && schema.anyOf.every((item) => schemaRequiresPath(item, pathSegments));
  const conditionalRequired = schema.if && schema.then && (
    (schemaGuaranteesCondition(guaranteeSchema, schema.if) && schemaRequiresPath(schema.then, pathSegments))
    || (schema.else && schemaRequiresPath(schema.then, pathSegments) && schemaRequiresPath(schema.else, pathSegments))
  );
  const segmentRequiredByComposition = nestedPathRequired && (
    (Array.isArray(schema.allOf) && schema.allOf.some((item) => schemaRequiresPath(item, [segment], schema)))
    || (Array.isArray(schema.oneOf) && schema.oneOf.length > 0 && schema.oneOf.every((item) => schemaRequiresPath(item, [segment])))
    || (Array.isArray(schema.anyOf) && schema.anyOf.length > 0 && schema.anyOf.every((item) => schemaRequiresPath(item, [segment])))
    || (schema.if && schema.then && (
      (schemaGuaranteesCondition(guaranteeSchema, schema.if) && schemaRequiresPath(schema.then, [segment]))
      || (schema.else && schemaRequiresPath(schema.then, [segment]) && schemaRequiresPath(schema.else, [segment]))
    ))
  );

  return directRequired || allOfRequired || oneOfRequired || anyOfRequired || conditionalRequired || segmentRequiredByComposition;
}

export function schemaAllowsNonString(schema) {
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

export function assertSchemaRequiresExpressionPath({ stepId, expression, field, rootSchema, pathSegments = expression.path }) {
  if (!schemaRequiresPath(rootSchema, pathSegments)) {
    fail(`step '${stepId}' ${field} expression ${expression.source} must reference a required output.schema path`);
  }
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

export function schemaVariants(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [];
  const variants = [schema];
  for (const key of ['oneOf', 'anyOf', 'allOf']) {
    if (Array.isArray(schema[key])) variants.push(...schema[key].flatMap((item) => schemaVariants(item)));
  }
  return variants;
}

export function schemaForPath(schema, pathSegments) {
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

export function schemaRootsForPath(schema, pathSegments) {
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

export function schemaAllowsNonArray(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return true;
  if (schema.const !== undefined) return !Array.isArray(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.some((value) => !Array.isArray(value));
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


export function mergeSelectorAnalysis(target, source) {
  for (const value of source.directValues) target.directValues.add(value);
  for (const value of source.itemValues) target.itemValues.add(value);
  target.arraySchemas.push(...source.arraySchemas);
  return target;
}

export function selectorAnalysis({ directValues = new Set(), itemValues = new Set(), arraySchemas = [] } = {}) {
  return { directValues, itemValues, arraySchemas };
}

export function assertClosedStringValueSchema(schema, errorContext) {
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

export function assertClosedDynamicTargetSchema(schema, errorContext) {
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

export function possibleStringTargetsForSchema(schema) {
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
