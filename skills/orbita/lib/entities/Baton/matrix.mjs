import { WorkflowRuntimeError, invariant } from '../../errors.mjs';
import { appendPromptText } from '../../runtime/prompt-text.mjs';
import { evaluatePathExpression } from '../Step/expressions/index.mjs';

export const MATRIX_STATE_KEY = 'matrix';
export const MATRIX_REQUEST_SEPARATOR = '__matrix__';
export const MATRIX_UNIT_ID = /^[A-Za-z0-9_-]+$/;

function clone(value) {
  return structuredClone(value);
}

function fail(message) {
  throw new WorkflowRuntimeError(`workflow matrix validation failed: ${message}`);
}

function assertSafeUnitId(value, fieldPath) {
  if (typeof value !== 'string' || !MATRIX_UNIT_ID.test(value) || value === '.' || value === '..') {
    fail(`${fieldPath} must be a safe matrix unit id matching ${MATRIX_UNIT_ID}`);
  }
  if (value.includes(MATRIX_REQUEST_SEPARATOR)) {
    fail(`${fieldPath} must not contain reserved separator '${MATRIX_REQUEST_SEPARATOR}'`);
  }
  return value;
}

function assertSafeContextKey(value, fieldPath) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) {
    fail(`${fieldPath} must be a safe object field name`);
  }
  return value;
}

export function matrixRequestId(ownerStepId, unitId) {
  return `${ownerStepId}${MATRIX_REQUEST_SEPARATOR}${unitId}`;
}

export function matrixPlanId(ownerStepId) {
  return `${ownerStepId}:matrix_v1`;
}

export function isMatrixStep(step) {
  return step?.kind === 'matrix';
}

export function normalizeMatrixSource(source, { stepId = '<unknown>' } = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail(`step '${stepId}' matrix.source must be an object`);
  if (Array.isArray(source.items)) {
    if (source.items.length === 0) fail(`step '${stepId}' matrix.source.items must be a non-empty array`);
    return {
      kind: 'static',
      items: source.items.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`step '${stepId}' matrix.source.items/${index} must be an object`);
        return {
          id: assertSafeUnitId(item.id, `step '${stepId}' matrix.source.items/${index}/id`),
          required: true,
          context: item.context === undefined ? {} : clone(item.context),
        };
      }),
    };
  }

  if (typeof source.from === 'string') {
    const contextFields = source.context_fields === undefined ? [] : source.context_fields;
    if (!Array.isArray(contextFields)) fail(`step '${stepId}' matrix.source.context_fields must be an array`);
    return {
      kind: 'dynamic',
      from: source.from,
      idField: assertSafeContextKey(source.id_field ?? 'id', `step '${stepId}' matrix.source.id_field`),
      contextFields: contextFields.map((field, index) => assertSafeContextKey(field, `step '${stepId}' matrix.source.context_fields/${index}`)),
    };
  }

  fail(`step '${stepId}' matrix.source must declare static items or dynamic from`);
}

function unitRecordsForStaticSource(ownerStepId, source) {
  return source.items.map((item) => ({
    unit_id: item.id,
    request_id: matrixRequestId(ownerStepId, item.id),
    status: 'pending',
    required: item.required,
    attempts: 0,
    context: clone(item.context),
  }));
}

function safeContextForItem(item, fields) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return {};
  const context = {};
  for (const field of fields) {
    if (Object.hasOwn(item, field)) context[field] = clone(item[field]);
  }
  return context;
}

function unitRecordsForDynamicSource(ownerStepId, source, baton) {
  let items;
  try {
    items = evaluatePathExpression(source.from, { input: baton?.state ?? {}, output: {} });
  } catch (error) {
    throw new WorkflowRuntimeError(`workflow matrix validation failed: step '${ownerStepId}' source.from ${error.message}`);
  }
  if (!Array.isArray(items) || items.length === 0) fail(`step '${ownerStepId}' matrix.source.from must resolve to a non-empty array`);
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`step '${ownerStepId}' matrix.source.from item ${index} must be an object`);
    const unitId = assertSafeUnitId(item[source.idField], `step '${ownerStepId}' matrix.source.from item ${index}.${source.idField}`);
    return {
      unit_id: unitId,
      request_id: matrixRequestId(ownerStepId, unitId),
      status: 'pending',
      required: true,
      attempts: 0,
      context: safeContextForItem(item, source.contextFields),
    };
  });
}

function assertUniqueUnits(ownerStepId, units) {
  const seen = new Set();
  for (const unit of units) {
    if (seen.has(unit.unit_id)) fail(`step '${ownerStepId}' declares duplicate matrix unit id '${unit.unit_id}'`);
    seen.add(unit.unit_id);
  }
}

function sourceFingerprint(source, units) {
  return JSON.stringify({
    source,
    units: units.map((unit) => ({ unit_id: unit.unit_id, required: unit.required, context: unit.context })),
  });
}

export function matrixUnitsForStep({ ownerStepId, ownerStep, baton }) {
  const source = normalizeMatrixSource(ownerStep.source, { stepId: ownerStepId });
  const units = source.kind === 'static'
    ? unitRecordsForStaticSource(ownerStepId, source)
    : unitRecordsForDynamicSource(ownerStepId, source, baton);
  assertUniqueUnits(ownerStepId, units);
  return { source, units, fingerprint: sourceFingerprint(source, units) };
}

export function createMatrixPlan({ ownerStepId, ownerStep, baton, previousPlan }) {
  const maxParallel = ownerStep.max_parallel ?? 1;
  const maxAttempts = ownerStep.max_attempts ?? 1;
  if (!Number.isInteger(maxParallel) || maxParallel < 1 || maxParallel > 16) fail(`step '${ownerStepId}' max_parallel must be an integer from 1 to 16`);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) fail(`step '${ownerStepId}' max_attempts must be an integer from 1 to 10`);

  const { source, units, fingerprint } = matrixUnitsForStep({ ownerStepId, ownerStep, baton });
  if (previousPlan) {
    if (previousPlan.source_fingerprint !== fingerprint) {
      throw new WorkflowRuntimeError(`workflow matrix validation failed: step '${ownerStepId}' source fingerprint changed after initialization`);
    }
    if (previousPlan.status === 'blocked' && baton?.recoverableWorkerBlockers?.[ownerStepId]?.resolution) {
      return {
        ...clone(previousPlan),
        status: 'dispatching',
        current_requests: [],
        units: previousPlan.units.map((unit) => unit.status === 'blocked' ? { ...clone(unit), status: 'pending' } : clone(unit)),
        blocked: {},
        join_proof: null,
      };
    }
    return clone(previousPlan);
  }

  return {
    plan_id: matrixPlanId(ownerStepId),
    owner_step_id: ownerStepId,
    status: 'dispatching',
    source,
    source_fingerprint: fingerprint,
    max_parallel: maxParallel,
    max_attempts: maxAttempts,
    current_requests: [],
    units,
    accepted_outputs: {},
    blocked: {},
    join_proof: null,
  };
}

export function matrixPlanForBaton({ baton, ownerStepId, ownerStep }) {
  const previousPlan = baton?.state?.[MATRIX_STATE_KEY]?.[ownerStepId];
  return createMatrixPlan({ ownerStepId, ownerStep, baton, previousPlan });
}

export function batonWithMatrixPlan(baton, ownerStepId, plan) {
  return {
    ...clone(baton),
    state: {
      ...(baton?.state ?? {}),
      [MATRIX_STATE_KEY]: {
        ...(baton?.state?.[MATRIX_STATE_KEY] ?? {}),
        [ownerStepId]: clone(plan),
      },
    },
  };
}

function promptSuffix({ ownerStepId, unit }) {
  return [
    `Matrix owner step: ${ownerStepId}`,
    `Matrix unit id: ${unit.unit_id}`,
    `Matrix request id: ${unit.request_id}`,
    'Return output for only this matrix unit.',
    'Do not include matrix owner/unit/request metadata unless the output schema explicitly requires it.',
    '',
    'Safe matrix item context:',
    '```json',
    JSON.stringify(unit.context ?? {}, null, 2),
    '```',
  ].join('\n');
}

export function stepForMatrixUnit(ownerStepId, ownerStep, unit) {
  const step = clone(ownerStep.worker);
  step.name = step.name ?? `${ownerStep.name ?? ownerStepId} / ${unit.unit_id}`;
  step.kind = 'worker';
  step.agent = matrixRequestId(ownerStepId, unit.unit_id);
  step.next = ownerStep.next;
  step.input = {
    ...(step.input ?? {}),
    prompt: appendPromptText(step.input?.prompt, promptSuffix({ ownerStepId, unit })),
  };
  return step;
}

function activeRequestUnits(plan) {
  const byRequestId = new Map(plan.units.map((unit) => [unit.request_id, unit]));
  return (plan.current_requests ?? []).map((requestId) => byRequestId.get(requestId)).filter(Boolean);
}

function nextRequestUnits(plan) {
  if (Array.isArray(plan.current_requests) && plan.current_requests.length > 0) return activeRequestUnits(plan);
  return plan.units
    .filter((unit) => unit.status === 'pending')
    .slice(0, plan.max_parallel);
}

export function planWithCurrentMatrixRequests(plan) {
  if (Array.isArray(plan.current_requests) && plan.current_requests.length > 0) return plan;
  const requestUnits = nextRequestUnits(plan);
  return {
    ...clone(plan),
    current_requests: requestUnits.map((unit) => unit.request_id),
  };
}

export function matrixStepEntries(ownerStepId, ownerStep, baton) {
  const plan = planWithCurrentMatrixRequests(matrixPlanForBaton({ baton, ownerStepId, ownerStep }));
  return nextRequestUnits(plan).map((unit) => ({
    id: unit.request_id,
    ownerStepId,
    action: 'run_worker',
    step: stepForMatrixUnit(ownerStepId, ownerStep, unit),
    matrix: {
      owner_step_id: ownerStepId,
      unit_id: unit.unit_id,
      request_id: unit.request_id,
      required: unit.required,
      attempts: unit.attempts,
      max_attempts: plan.max_attempts,
      context: clone(unit.context ?? {}),
    },
  }));
}

export function joinProofForMatrix({ ownerStepId, plan }) {
  const acceptedUnitIds = Object.keys(plan.accepted_outputs ?? {}).sort();
  const blockedUnitIds = Object.keys(plan.blocked ?? {}).sort();
  const requiredUnitIds = plan.units.filter((unit) => unit.required).map((unit) => unit.unit_id).sort();
  const optionalUnitIds = plan.units.filter((unit) => !unit.required).map((unit) => unit.unit_id).sort();
  const missingRequiredUnitIds = requiredUnitIds.filter((unitId) => !acceptedUnitIds.includes(unitId));
  const coverageComplete = missingRequiredUnitIds.length === 0 && !requiredUnitIds.some((unitId) => blockedUnitIds.includes(unitId));
  return {
    owner_step_id: ownerStepId,
    plan_id: matrixPlanId(ownerStepId),
    required_unit_ids: requiredUnitIds,
    optional_unit_ids: optionalUnitIds,
    accepted_unit_ids: acceptedUnitIds,
    blocked_unit_ids: blockedUnitIds,
    missing_required_unit_ids: missingRequiredUnitIds,
    coverage_complete: coverageComplete,
    outcome: coverageComplete ? 'pass' : 'block',
    reason: coverageComplete ? 'required matrix units accepted' : 'required matrix coverage incomplete',
  };
}

export function matrixOutputForRequest(allOutput, requestId) {
  const steps = allOutput?.steps;
  invariant(steps && typeof steps === 'object' && !Array.isArray(steps), 'matrix output must include object steps');
  return steps[requestId];
}

export function assertNoUnexpectedMatrixOutputs(allOutput, plan) {
  const steps = allOutput?.steps;
  invariant(steps && typeof steps === 'object' && !Array.isArray(steps), 'matrix output must include object steps');
  const expected = new Set(plan.current_requests ?? []);
  for (const key of Object.keys(steps)) {
    invariant(expected.has(key), `matrix output included unexpected request '${key}'`);
  }
}
