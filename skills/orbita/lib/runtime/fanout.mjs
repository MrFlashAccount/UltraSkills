/**
 * IO-free fanout activation planning and executable-step materialization.
 * Durable activation records, never request-id parsing or arbitrary state scans,
 * determine the current fanout phase and selected branch work.
 */
import { WorkflowRuntimeError } from '../errors.mjs';
import { evaluatePathExpression } from '../entities/Step/expressions/index.mjs';
import { appendPromptText } from './prompt-text.mjs';
import { isDangerousObjectKey, isReservedStateKey } from './state-keys.mjs';

export const FANOUT_STATE_KEY = 'fanouts';
export const FANOUT_REQUEST_SEPARATOR = '__fanout__';

export function fanoutBranchIdIssues(workflow) {
  const topLevelStepIds = new Set(Object.keys(workflow.steps));
  const globalBranchOwners = new Map();
  const issues = [];
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!isFanoutStep(step)) continue;
    for (const branchId of Object.keys(step.branches ?? {})) {
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(branchId) || branchId.includes(FANOUT_REQUEST_SEPARATOR)) {
        issues.push(`step '${stepId}' fanout branch id '${branchId}' is unsafe`);
      } else if (isReservedStateKey(branchId) || isDangerousObjectKey(branchId)) {
        issues.push(`step '${stepId}' fanout branch id '${branchId}' is reserved for runtime state`);
      } else if (topLevelStepIds.has(branchId)) {
        issues.push(`step '${stepId}' fanout branch id '${branchId}' collides with a workflow step id`);
      } else if (globalBranchOwners.has(branchId)) {
        issues.push(`step '${stepId}' fanout branch id '${branchId}' collides with fanout step '${globalBranchOwners.get(branchId)}'`);
      }
      globalBranchOwners.set(branchId, stepId);
    }
  }
  return issues;
}

function clone(value) {
  return structuredClone(value);
}

function fail(message) {
  throw new WorkflowRuntimeError(`workflow fanout validation failed: ${message}`);
}

export function isFanoutStep(step) {
  return step?.kind === 'fanout';
}

export function fanoutRequestId(ownerStepId, activation, branchId) {
  return `${ownerStepId}${FANOUT_REQUEST_SEPARATOR}${activation}__${branchId}`;
}

function resolvedExpression(expression, baton) {
  return evaluatePathExpression(expression, { input: baton?.state ?? {}, output: {} });
}

function resolveFirstAvailable(expressions, baton) {
  let lastError;
  for (const expression of expressions) {
    try {
      const value = resolvedExpression(expression, baton);
      if (Array.isArray(value) && value.length === 0) continue;
      return value;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return undefined;
}

export function resolveFanoutBranchIds({ ownerStepId, ownerStep, baton }) {
  const selection = ownerStep?.input?.branches;
  let value;
  if (Array.isArray(selection)) value = selection;
  else if (typeof selection === 'string') value = resolvedExpression(selection, baton);
  else if (selection && typeof selection === 'object' && !Array.isArray(selection) && Array.isArray(selection.first_of)) {
    value = resolveFirstAvailable(selection.first_of, baton);
  } else {
    fail(`step '${ownerStepId}' input.branches must be a static branch id array, an input expression, or first_of expressions`);
  }

  if (!Array.isArray(value) || value.length === 0) {
    fail(`step '${ownerStepId}' input.branches must resolve to a non-empty array`);
  }
  const seen = new Set();
  for (const [index, branchId] of value.entries()) {
    if (typeof branchId !== 'string' || branchId.length === 0) {
      fail(`step '${ownerStepId}' input.branches item ${index} must be a non-empty branch id`);
    }
    if (!Object.hasOwn(ownerStep.branches ?? {}, branchId)) {
      fail(`step '${ownerStepId}' input.branches references unknown branch '${branchId}'`);
    }
    if (seen.has(branchId)) fail(`step '${ownerStepId}' input.branches includes duplicate branch '${branchId}'`);
    seen.add(branchId);
  }
  return [...value];
}

function branchRecords(ownerStepId, activation, branchIds) {
  return branchIds.map((branchId) => ({
    branch_id: branchId,
    request_id: fanoutRequestId(ownerStepId, activation, branchId),
    status: 'pending',
  }));
}

export function createFanoutActivation({ ownerStepId, ownerStep, baton, previousActivation }) {
  const activation = (previousActivation?.activation ?? 0) + 1;
  const selectedBranchIds = resolveFanoutBranchIds({ ownerStepId, ownerStep, baton });
  const maxParallel = ownerStep.max_parallel ?? selectedBranchIds.length;
  if (!Number.isInteger(maxParallel) || maxParallel < 1 || maxParallel > 16) {
    fail(`step '${ownerStepId}' max_parallel must be an integer from 1 to 16`);
  }
  return {
    owner_step_id: ownerStepId,
    activation,
    phase: 'branches',
    status: 'awaiting_branches',
    selected_branch_ids: selectedBranchIds,
    max_parallel: maxParallel,
    current_requests: [],
    branch_records: branchRecords(ownerStepId, activation, selectedBranchIds),
    accepted_outputs: {},
  };
}

export function fanoutActivationForBaton({ baton, ownerStepId, ownerStep }) {
  const previous = baton?.state?.[FANOUT_STATE_KEY]?.[ownerStepId];
  if (previous && previous.phase !== 'completed') return clone(previous);
  return createFanoutActivation({ ownerStepId, ownerStep, baton, previousActivation: previous });
}

export function batonWithFanoutActivation(baton, ownerStepId, activation) {
  return {
    ...clone(baton),
    state: {
      ...(baton?.state ?? {}),
      [FANOUT_STATE_KEY]: {
        ...(baton?.state?.[FANOUT_STATE_KEY] ?? {}),
        [ownerStepId]: clone(activation),
      },
    },
  };
}

function currentBranchRecords(activation) {
  const byRequestId = new Map(activation.branch_records.map((record) => [record.request_id, record]));
  return activation.current_requests.map((requestId) => byRequestId.get(requestId)).filter(Boolean);
}

export function activationWithCurrentRequests(activation) {
  if (activation.phase !== 'branches' || activation.current_requests.length > 0) return clone(activation);
  const pending = activation.branch_records
    .filter((record) => record.status === 'pending')
    .slice(0, activation.max_parallel);
  if (pending.length === 0) {
    return {
      ...clone(activation),
      phase: 'owner',
      status: 'awaiting_owner',
      current_requests: [activation.owner_step_id],
    };
  }
  return {
    ...clone(activation),
    current_requests: pending.map((record) => record.request_id),
  };
}

function branchPromptSuffix({ ownerStepId, activation, record }) {
  return [
    `Fanout owner step: ${ownerStepId}`,
    `Fanout activation: ${activation.activation}`,
    `Fanout branch id: ${record.branch_id}`,
    'Return output for only this fanout branch.',
    'Do not aggregate other branches or advance the owner workflow step.',
  ].join('\n');
}

export function stepForFanoutBranch(ownerStepId, ownerStep, activation, record) {
  const branch = clone(ownerStep.branches[record.branch_id]);
  return {
    ...branch,
    name: branch.name ?? `${ownerStep.name ?? ownerStepId} / ${record.branch_id}`,
    kind: 'worker',
    next: ownerStepId,
    input: {
      ...(branch.input ?? {}),
      prompt: appendPromptText(branch.input?.prompt, branchPromptSuffix({ ownerStepId, activation, record })),
    },
  };
}

function publicFanoutContext(activation, extra = {}) {
  return {
    owner_step_id: activation.owner_step_id,
    activation: activation.activation,
    phase: activation.phase,
    selected_branch_ids: [...activation.selected_branch_ids],
    ...extra,
  };
}

export function fanoutStepEntries(ownerStepId, ownerStep, baton) {
  const activation = activationWithCurrentRequests(fanoutActivationForBaton({ baton, ownerStepId, ownerStep }));
  if (activation.phase === 'owner') {
    return [{
      id: ownerStepId,
      action: 'run_worker',
      step: clone(ownerStep),
      fanout: publicFanoutContext(activation),
    }];
  }
  return currentBranchRecords(activation).map((record) => ({
    id: record.request_id,
    ownerStepId,
    action: 'run_worker',
    step: stepForFanoutBranch(ownerStepId, ownerStep, activation, record),
    fanout: publicFanoutContext(activation, {
      branch_id: record.branch_id,
      request_id: record.request_id,
    }),
  }));
}

export function fanoutActivationWithRequests({ baton, ownerStepId, ownerStep }) {
  return activationWithCurrentRequests(fanoutActivationForBaton({ baton, ownerStepId, ownerStep }));
}

export function branchRecordForRequest(activation, requestId) {
  return activation.branch_records.find((record) => record.request_id === requestId);
}

export function batonForFanoutPrompt({ workflow, baton, entry }) {
  const ownerStepId = entry?.fanout?.owner_step_id ?? entry?.id;
  const durableActivation = baton?.state?.[FANOUT_STATE_KEY]?.[ownerStepId];
  const phase = entry?.fanout?.phase ?? durableActivation?.phase;
  if (phase !== 'owner') return baton;
  const ownerStep = workflow.steps?.[ownerStepId];
  if (!isFanoutStep(ownerStep)) return baton;
  const selected = new Set(entry?.fanout?.selected_branch_ids ?? durableActivation?.selected_branch_ids ?? []);
  const projected = clone(baton);
  projected.state = { ...(projected.state ?? {}) };
  for (const branchId of Object.keys(ownerStep.branches ?? {})) {
    if (!selected.has(branchId)) delete projected.state[branchId];
  }
  return projected;
}
