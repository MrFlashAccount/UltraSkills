import { invariant } from '../errors.mjs';
import { parsePathExpression } from './expression.mjs';
import { assertTransitionTarget } from './transition-targets.mjs';

const NEXT_KIND = Object.freeze({
  STATIC_TARGET: 'static-target',
  DYNAMIC_TARGET: 'dynamic-target',
  MATCH_CASES: 'match-cases',
});

function workflowData(workflow) {
  return typeof workflow?.toJSON === 'function' ? workflow.toJSON() : workflow;
}

function normalizeTransitionItem(item) {
  invariant(!Array.isArray(item), 'workflow transition must be one scalar target or match/cases object');
  if (typeof item === 'string') {
    if (item.includes('${{')) return { kind: NEXT_KIND.DYNAMIC_TARGET, expression: parsePathExpression(item) };
    return { kind: NEXT_KIND.STATIC_TARGET, target: item };
  }

  return { kind: NEXT_KIND.MATCH_CASES, expression: parsePathExpression(item.match), cases: item.cases };
}

export function normalizeTransitionNext(next) {
  invariant(!Array.isArray(next), 'workflow next must be one scalar transition, not an array');
  return normalizeTransitionItem(next);
}

export function isDynamicTransitionNext(next) {
  if (next === undefined) return false;
  const kind = normalizeTransitionNext(next).kind;
  return kind === NEXT_KIND.DYNAMIC_TARGET || kind === NEXT_KIND.MATCH_CASES;
}

function isMatchCasesObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && 'match' in value && 'cases' in value;
}

export function assertNoNestedMatchCasesTarget(target, fieldPath) {
  invariant(!isMatchCasesObject(target), `nested match/cases transitions are not supported at ${fieldPath}`);
}

function assertMatchCasesTargets(workflow, stepId, descriptor, fieldPath = 'next') {
  for (const [value, target] of Object.entries(descriptor.cases)) {
    const path = `${fieldPath}.cases.${value}`;
    assertNoNestedMatchCasesTarget(target, path);
    invariant(typeof target === 'string' && target.length > 0, `workflow step '${stepId}' ${path} must be a scalar step id`);
    assertTransitionTarget(workflow, stepId, path, target);
  }
}

export function assertTransitionDescriptorTargets(workflowInput, stepId, descriptor = normalizeTransitionNext(workflowData(workflowInput).steps[stepId].next), fieldPath = 'next') {
  const workflow = workflowData(workflowInput);
  if (descriptor.kind === NEXT_KIND.STATIC_TARGET) {
    assertTransitionTarget(workflow, stepId, fieldPath, descriptor.target);
    return;
  }

  if (descriptor.kind === NEXT_KIND.DYNAMIC_TARGET) return;

  if (descriptor.kind === NEXT_KIND.MATCH_CASES) {
    assertMatchCasesTargets(workflow, stepId, descriptor, fieldPath);
    return;
  }

  invariant(false, `workflow step '${stepId}' has unsupported transition kind '${descriptor.kind}'`);
}

export { NEXT_KIND };
