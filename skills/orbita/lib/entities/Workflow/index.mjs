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
import { assertTransitionDescriptorTargets, NEXT_KIND, normalizeTransitionNext } from '../../runtime/transition-next.mjs';
import { isShardStep } from '../../runtime/shard.mjs';
import { fanoutBranchIdIssues, isFanoutStep } from '../../runtime/fanout.mjs';
import {
  assertClosedDynamicTargetSchema,
  assertClosedStringValueSchema,
  assertSchemaRequiresExpressionPath,
  mergeSelectorAnalysis,
  normalizeStepOutputSchemas,
  possibleStringTargetsForSchema,
  schemaAllowsNonArray,
  schemaAllowsNonString,
  schemaForPath,
  schemaRootsForPath,
  schemaVariants,
  selectorAnalysis,
} from './schema-semantics.mjs';

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
  const transitionCaseKeys = possibleCaseKeys;
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
    if (Object.hasOwn(step, 'onReject')) {
      try {
        assertTransitionDescriptorTargets(workflow, stepId, normalizeTransitionNext(step.onReject), 'onReject');
      } catch (error) {
        if (error instanceof WorkflowRuntimeError) fail(error.message);
        throw error;
      }
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

function collectExpandedDescriptorEdges({ workflow, schemasByStep, stepId, step, next, field, requireSchemaCoverage, requireExpressionRequiredPaths, allowUnreachableCases }) {
  let descriptor;
  try {
    descriptor = normalizeTransitionNext(next);
    assertTransitionDescriptorTargets(workflow, stepId, descriptor, field);
  } catch (error) {
    if (error instanceof WorkflowRuntimeError) fail(error.message);
    throw error;
  }
  if (descriptor.kind === 'static-target') return edgeRows(stepId, [[descriptor.target]]);
  if (descriptor.kind === 'dynamic-target') {
    const aggregate = assertDynamicTargetSchema({ workflow, schemasByStep, stepId, step, expression: descriptor.expression, field, requireSchemaCoverage, requireExpressionRequiredPaths });
    return aggregate ? edgeRows(stepId, targetSetsForDynamicTarget(aggregate)) : [];
  }
  if (descriptor.kind === 'match-cases') {
    const possibleCaseKeys = assertMatchCasesSchema({ workflow, schemasByStep, stepId, step, descriptor, field, requireSchemaCoverage, requireExpressionRequiredPaths, allowUnreachableCases });
    return possibleCaseKeys ? [...possibleCaseKeys].flatMap((matchValue) => (
      edgeRows(stepId, [[descriptor.cases[matchValue]]]).map((edge) => ({ ...edge, matchValue }))
    )) : [];
  }
  return [];
}

function collectExpandedRouteGraphEdges(workflow, schemasByStep, { requireSchemaCoverage = true, requireExpressionRequiredPaths = true, allowUnreachableCases = false } = {}) {
  const edges = [];
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!Object.hasOwn(step, 'next')) continue;
    edges.push(...collectExpandedDescriptorEdges({
      workflow,
      schemasByStep,
      stepId,
      step,
      next: step.next,
      field: 'next',
      requireSchemaCoverage,
      requireExpressionRequiredPaths,
      allowUnreachableCases,
    }));
    if (Object.hasOwn(step, 'onReject')) {
      edges.push(...collectExpandedDescriptorEdges({
        workflow,
        schemasByStep,
        stepId,
        step,
        next: step.onReject,
        field: 'onReject',
        requireSchemaCoverage,
        requireExpressionRequiredPaths,
        allowUnreachableCases,
      }).map((edge) => ({ ...edge, approval: 'rejected' })));
    }
  }
  return edges;
}

function collectExpandedOnLimitEdges(workflow, schemasByStep, options = {}) {
  const edges = [];
  for (const [policyId, policy] of Object.entries(workflow.loopPolicies ?? {})) {
    const step = workflow.steps[policy.boundary];
    if (!step) continue;
    const policyEdges = collectExpandedDescriptorEdges({
      workflow,
      schemasByStep,
      stepId: policy.boundary,
      step,
      next: policy.onLimit,
      field: `loopPolicies.${policyId}.onLimit`,
      requireSchemaCoverage: options.requireSchemaCoverage ?? true,
      requireExpressionRequiredPaths: options.requireExpressionRequiredPaths ?? true,
      allowUnreachableCases: options.allowUnreachableCases ?? false,
    });
    edges.push(...policyEdges.map((edge) => ({ ...edge, policyId })));
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

function parseApprovalInputSelector(stepId, field, source) {
  let expression;
  try {
    expression = parsePathExpression(source, { allowedRoots: ['input'] });
  } catch (error) {
    if (error instanceof WorkflowRuntimeError) fail(`step '${stepId}' ${field} ${error.message}`);
    throw error;
  }
  if (expression.path.length < 2) fail(`step '${stepId}' ${field} selector must include an input producer and output field path`);
  if (expression.path[0] === stepId) fail(`step '${stepId}' ${field} selector cannot select the current approval gate`);
  return expression;
}

function assertSchemasAllowOnlyString(schemas, context) {
  if (schemas.length === 0 || schemas.some((schema) => schemaAllowsNonString(schema))) fail(`${context} must resolve only to strings`);
}

function schemaAllowsOnlyArray(schema) {
  return !schemaAllowsNonArray(schema);
}

function schemaArrayItemsAllowOnlyStrings(schema) {
  const arrays = schemaVariants(schema).filter((candidate) => candidate?.type === 'array' || candidate?.items);
  return arrays.length > 0 && arrays.every((candidate) => {
    if (!candidate.items) return false;
    try {
      assertClosedStringValueSchema(candidate.items, 'approval verdict summary array item');
      return true;
    } catch {
      return candidate.items.type === 'string';
    }
  });
}

function assertApprovalSelector({ workflow, schemasByStep, stepId, step, field, source, kind, requirePath = true }) {
  const expression = parseApprovalInputSelector(stepId, field, source);
  const resolved = assertExpressionSchemaAvailable({
    workflow,
    schemasByStep,
    stepId,
    step,
    expression,
    field,
    requireSchemaCoverage: true,
  });
  if (requirePath) assertSchemaRequiresExpressionPath({ stepId, expression, field, rootSchema: resolved.rootSchema, pathSegments: resolved.requiredPath });
  if (kind === 'string') assertSchemasAllowOnlyString(resolved.schema, `step '${stepId}' ${field}`);
  if (kind === 'array' && resolved.schema.some((schema) => !schemaAllowsOnlyArray(schema))) {
    fail(`step '${stepId}' ${field} must resolve only to arrays`);
  }
  if (kind === 'string-or-string-array') {
    const invalid = resolved.schema.some((schema) => schemaAllowsNonString(schema) && !schemaArrayItemsAllowOnlyStrings(schema));
    if (invalid) fail(`step '${stepId}' ${field} must resolve only to a string or array of strings`);
  }
  return expression;
}

function executableRouteGraphEdges(workflow, expandedEdges, expandedOnLimitEdges) {
  const edges = [...expandedEdges];
  for (const [policyId, policy] of Object.entries(workflow.loopPolicies ?? {})) {
    const region = new Set(policy.steps);
    const limitEdges = expandedOnLimitEdges.filter((edge) => edge.policyId === policyId);
    for (const edge of expandedEdges) {
      if (region.has(edge.from) && region.has(edge.to)
        && edge.from === policy.boundary && edge.to === policy.entry) {
        for (const limitEdge of limitEdges) {
          edges.push({ ...edge, to: limitEdge.to, fanout: false, onLimitPolicyId: policyId });
        }
      }
    }
  }
  return edges.filter((edge, index) => edges.findIndex((candidate) => (
    candidate.from === edge.from && candidate.to === edge.to && candidate.fanout === edge.fanout
      && candidate.matchValue === edge.matchValue && candidate.onLimitPolicyId === edge.onLimitPolicyId
  )) === index);
}

function workflowPathExists(routeEdges, from, to, { excluding } = {}) {
  if (from === excluding || to === excluding) return false;
  const adjacency = new Map();
  for (const edge of routeEdges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  const pending = [from];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.shift();
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const target of adjacency.get(current) ?? []) {
      if (target !== excluding && !visited.has(target)) pending.push(target);
    }
  }
  return false;
}

function assertSelectorProducerGuaranteedBefore(workflow, routeEdges, stepId, field, expression) {
  const producerStepId = expression.path[0];
  if (producerStepId === stepId) {
    fail(`step '${stepId}' ${field} selector cannot select the current approval gate`);
  }
  const producerIsReachable = workflowPathExists(routeEdges, workflow.start, producerStepId);
  const gateIsReachableWithoutProducer = workflowPathExists(routeEdges, workflow.start, stepId, { excluding: producerStepId });
  if (!producerIsReachable || gateIsReachableWithoutProducer) {
    fail(`step '${stepId}' ${field} selector producer '${producerStepId}' is not guaranteed to execute before the approval gate`);
  }
}

function assertApprovalVerdictTopology({ workflow, routeEdges, stepId, verdict, selectorExpressions }) {
  const includeExpression = selectorExpressions.includeWhen;
  const criticExpression = selectorExpressions.outcome;
  const producerStepId = includeExpression.path[0];
  const criticStepId = criticExpression.path[0];
  for (const [field, expression] of Object.entries({ summary: selectorExpressions.summary, findings: selectorExpressions.findings })) {
    if (expression.path[0] !== criticStepId) fail(`step '${stepId}' input.verdict.${field} must select the same critic '${criticStepId}' as input.verdict.outcome`);
  }

  const producer = workflow.steps[producerStepId];
  const producerNext = producer?.next;
  const producerMatch = typeof producerNext?.match === 'string'
    ? parsePathExpression(producerNext.match)
    : undefined;
  if (!producerMatch || producerMatch.root !== 'output' || JSON.stringify(producerMatch.path) !== JSON.stringify(includeExpression.path.slice(1))) {
    fail(`step '${stepId}' verdict include_when selector must match producer '${producerStepId}' next.match output path`);
  }
  if (producerNext.cases?.[verdict.include_when.equals] !== criticStepId) {
    fail(`step '${stepId}' verdict include_when value '${verdict.include_when.equals}' must route producer '${producerStepId}' to critic '${criticStepId}'`);
  }
  const directCorrection = Object.entries(producerNext.cases ?? {})
    .some(([value, target]) => value !== verdict.include_when.equals && target === stepId);
  if (!directCorrection) {
    fail(`step '${stepId}' verdict topology must include a producer '${producerStepId}' direct-correction route to the gate where include_when is false`);
  }

  const critic = workflow.steps[criticStepId];
  const criticNext = critic?.next;
  const criticMatch = typeof criticNext?.match === 'string'
    ? parsePathExpression(criticNext.match)
    : undefined;
  if (!criticMatch || criticMatch.root !== 'output' || JSON.stringify(criticMatch.path) !== JSON.stringify(criticExpression.path.slice(1))) {
    fail(`step '${stepId}' verdict outcome selector must match critic '${criticStepId}' next.match output path`);
  }
  if (criticNext.cases?.approved !== stepId) {
    fail(`step '${stepId}' verdict critic '${criticStepId}' approved route must target the current approval gate`);
  }

  const conditionalEdges = routeEdges.filter((edge) => !(
    edge.from === producerStepId && edge.matchValue !== undefined && edge.matchValue !== verdict.include_when.equals
  ));
  const ordinaryEdges = conditionalEdges.filter((edge) => !edge.onLimitPolicyId);
  const onLimitEdges = conditionalEdges.filter((edge) => edge.onLimitPolicyId);
  const reachesGateWithoutCritic = (from) => workflowPathExists(conditionalEdges, from, stepId, { excluding: criticStepId });
  const canReachOnLimitWithoutCritic = (from, limitEdge) => workflowPathExists(ordinaryEdges, from, limitEdge.from, { excluding: criticStepId });
  const edgeCanTriggerOnLimit = (edge, limitEdge) => (
    (edge.from === limitEdge.from && edge.matchValue === limitEdge.matchValue)
    || canReachOnLimitWithoutCritic(edge.to, limitEdge)
  );
  const producerAttackEdges = conditionalEdges.filter((edge) => edge.from === producerStepId
    && edge.matchValue === verdict.include_when.equals && !edge.onLimitPolicyId);
  if (producerAttackEdges.some((edge) => onLimitEdges.some((limitEdge) => (
    edgeCanTriggerOnLimit(edge, limitEdge) && reachesGateWithoutCritic(limitEdge.to)
  )))) {
    fail(`step '${stepId}' verdict topology permits loopPolicies.onLimit to bypass critic '${criticStepId}' while include_when is true`);
  }
  const criticNonSuccessEdges = conditionalEdges.filter((edge) => edge.from === criticStepId
    && edge.matchValue !== 'approved' && !edge.onLimitPolicyId);
  if (criticNonSuccessEdges.some((edge) => onLimitEdges.some((limitEdge) => (
    edgeCanTriggerOnLimit(edge, limitEdge)
      && reachesGateWithoutCritic(limitEdge.to)
      && !(limitEdge.from === criticStepId && limitEdge.to === stepId)
  )))) {
    fail(`step '${stepId}' verdict topology permits loopPolicies.onLimit to route critic '${criticStepId}' non-success to the approval gate`);
  }
}

function assertApprovalRoutingSemantics(workflow) {
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (step.kind !== 'approval') continue;
    const next = normalizeTransitionNext(step.next);
    if (Object.hasOwn(step, 'onReject')) continue;
    if (next.kind !== NEXT_KIND.MATCH_CASES || next.expression.root !== 'output' || next.expression.path.length !== 1 || next.expression.path[0] !== 'approval') {
      fail(`step '${stepId}' approval next must match \${{ output.approval }} with approved and rejected cases, or declare onReject for a separate approved route`);
    }
  }
}

function assertApprovalProjectionSemantics(workflow, schemasByStep, routeEdges) {
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (step.kind !== 'approval') continue;
    const summary = assertApprovalSelector({ workflow, schemasByStep, stepId, step, field: 'input.summary', source: step.input?.summary, kind: 'string' });
    assertSelectorProducerGuaranteedBefore(workflow, routeEdges, stepId, 'input.summary', summary);

    for (const [index, source] of (step.input?.artifacts ?? []).entries()) {
      const expression = assertApprovalSelector({ workflow, schemasByStep, stepId, step, field: `input.artifacts[${index}]`, source, kind: 'array' });
      assertSelectorProducerGuaranteedBefore(workflow, routeEdges, stepId, `input.artifacts[${index}]`, expression);
    }

    if (step.input?.verdict) {
      const verdict = step.input.verdict;
      const selectorExpressions = {
        includeWhen: assertApprovalSelector({ workflow, schemasByStep, stepId, step, field: 'input.verdict.include_when.selector', source: verdict.include_when?.selector, kind: 'string' }),
        outcome: assertApprovalSelector({ workflow, schemasByStep, stepId, step, field: 'input.verdict.outcome', source: verdict.outcome, kind: 'string' }),
        summary: assertApprovalSelector({ workflow, schemasByStep, stepId, step, field: 'input.verdict.summary', source: verdict.summary, kind: 'string-or-string-array' }),
        findings: assertApprovalSelector({ workflow, schemasByStep, stepId, step, field: 'input.verdict.findings', source: verdict.findings, kind: 'array' }),
      };
      assertSelectorProducerGuaranteedBefore(workflow, routeEdges, stepId, 'input.verdict.include_when.selector', selectorExpressions.includeWhen);
      const includeResolved = schemaForExpression({ workflow, schemasByStep, stepId, step, expression: selectorExpressions.includeWhen });
      const allowedValues = includeResolved.schema.reduce((acc, schema) => mergeSelectorAnalysis(acc, assertClosedStringValueSchema(schema, `step '${stepId}' input.verdict.include_when.selector`)), selectorAnalysis()).directValues;
      if (!allowedValues.has(verdict.include_when.equals)) fail(`step '${stepId}' input.verdict.include_when.equals '${verdict.include_when.equals}' is not allowed by the selected producer schema`);
      assertApprovalVerdictTopology({ workflow, routeEdges, stepId, verdict, selectorExpressions });
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
  assertApprovalRoutingSemantics(workflow);
  assertTransitionSemantics(workflow, schemasByStep, {
    requireSchemaCoverage: options.requireSchemaCoverage ?? true,
    requireExpressionRequiredPaths: options.requireExpressionRequiredPaths ?? true,
    allowUnreachableCases: options.allowUnreachableCases ?? false,
    allowOpenTransitionSchemas: options.allowOpenTransitionSchemas ?? false,
  });
  const expandedRouteEdges = collectExpandedRouteGraphEdges(workflow, schemasByStep, {
    requireSchemaCoverage: options.requireSchemaCoverage ?? true,
    requireExpressionRequiredPaths: options.requireExpressionRequiredPaths ?? true,
    allowUnreachableCases: options.allowUnreachableCases ?? false,
  });
  const loopValidationOptions = {
    requireSchemaCoverage: options.requireSchemaCoverage ?? true,
    requireExpressionRequiredPaths: options.requireExpressionRequiredPaths ?? true,
    allowUnreachableCases: options.allowUnreachableCases ?? false,
  };
  const expandedOnLimitEdges = collectExpandedOnLimitEdges(workflow, schemasByStep, loopValidationOptions);
  if (workflow.loopPolicies !== undefined) {
    assertLoopPolicies(workflow, expandedRouteEdges, expandedOnLimitEdges);
  }
  assertApprovalProjectionSemantics(workflow, schemasByStep, executableRouteGraphEdges(workflow, expandedRouteEdges, expandedOnLimitEdges));
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
    Object.freeze(this.data);
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
      if (Object.hasOwn(step, 'onReject')) assertTransitionDescriptorTargets(this.data, stepId, normalizeTransitionNext(step.onReject), 'onReject');
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
