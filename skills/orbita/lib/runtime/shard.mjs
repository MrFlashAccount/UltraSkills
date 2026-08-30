/**
 * IO-free shard activation planning and executable-step materialization.
 * Resolved shard values are frozen in durable activation state so retries and
 * resumes preserve the original value order.
 */
import { WorkflowRuntimeError } from '../errors.mjs';
import { evaluatePathExpression } from '../entities/Step/expressions/index.mjs';

export const SHARD_STATE_KEY = 'shards';
export const SHARD_REQUEST_SEPARATOR = '__shard__';

function clone(value) {
  return structuredClone(value);
}

function fail(message) {
  throw new WorkflowRuntimeError(`workflow shard validation failed: ${message}`);
}

export function isShardStep(step) {
  return step?.kind === 'shard';
}

export function shardRequestId(parentStepId, activation, index) {
  return `${parentStepId}${SHARD_REQUEST_SEPARATOR}${activation}__${index}`;
}

export function resolveShardValues({ parentStepId, parentStep, baton }) {
  const source = parentStep?.input?.shards;
  let values;
  if (Array.isArray(source)) values = source;
  else if (typeof source === 'string') {
    try {
      values = evaluatePathExpression(source, { input: baton?.state ?? {}, output: {} });
    } catch (error) {
      throw new WorkflowRuntimeError(`workflow shard validation failed: step '${parentStepId}' input.shards ${error.message}`);
    }
  } else {
    fail(`step '${parentStepId}' input.shards must be a non-empty array or input.* expression`);
  }
  if (!Array.isArray(values) || values.length === 0) {
    fail(`step '${parentStepId}' input.shards must resolve to a non-empty array`);
  }
  return clone(values);
}

function shardRecords(parentStepId, activation, values) {
  return values.map((_, index) => ({
    index,
    request_id: shardRequestId(parentStepId, activation, index),
    status: 'pending',
  }));
}

export function createShardActivation({ parentStepId, parentStep, baton, previousActivation }) {
  const activation = (previousActivation?.activation ?? 0) + 1;
  const values = resolveShardValues({ parentStepId, parentStep, baton });
  const maxParallel = parentStep.max_parallel ?? values.length;
  if (!Number.isInteger(maxParallel) || maxParallel < 1 || maxParallel > 16) {
    fail(`step '${parentStepId}' max_parallel must be an integer from 1 to 16`);
  }
  return {
    parent_step_id: parentStepId,
    activation,
    phase: 'shards',
    status: 'awaiting_shards',
    values,
    max_parallel: maxParallel,
    current_requests: [],
    shard_records: shardRecords(parentStepId, activation, values),
    accepted_outputs: {},
  };
}

export function startShardActivation({ baton, parentStepId, parentStep }) {
  const previous = baton?.state?.[SHARD_STATE_KEY]?.[parentStepId];
  return createShardActivation({ parentStepId, parentStep, baton, previousActivation: previous });
}

export function currentShardActivation({ baton, parentStepId }) {
  const activation = baton?.state?.[SHARD_STATE_KEY]?.[parentStepId];
  if (!activation || activation.phase === 'completed') {
    fail(`step '${parentStepId}' has no active shard activation`);
  }
  return clone(activation);
}

export function batonWithShardActivation(baton, parentStepId, activation) {
  return {
    ...clone(baton),
    state: {
      ...(baton?.state ?? {}),
      [SHARD_STATE_KEY]: {
        ...(baton?.state?.[SHARD_STATE_KEY] ?? {}),
        [parentStepId]: clone(activation),
      },
    },
  };
}

function currentShardRecords(activation) {
  const byRequestId = new Map(activation.shard_records.map((record) => [record.request_id, record]));
  return activation.current_requests.map((requestId) => byRequestId.get(requestId)).filter(Boolean);
}

export function activationWithCurrentShardRequests(activation) {
  if (activation.phase !== 'shards' || activation.current_requests.length > 0) return clone(activation);
  const pending = activation.shard_records
    .filter((record) => record.status === 'pending')
    .slice(0, activation.max_parallel);
  if (pending.length === 0) {
    return {
      ...clone(activation),
      phase: 'worker',
      status: 'awaiting_worker',
      current_requests: [activation.parent_step_id],
    };
  }
  return {
    ...clone(activation),
    current_requests: pending.map((record) => record.request_id),
  };
}

export function stepForShardWorker(parentStepId, parentStep, activation, record) {
  const step = clone(parentStep.worker);
  step.name = step.name ?? `${parentStep.name ?? parentStepId} / shard ${record.index + 1}`;
  step.kind = 'worker';
  step.agent = record.request_id;
  step.next = parentStepId;
  return step;
}

function publicShardContext(activation, record) {
  return {
    parent_step_id: activation.parent_step_id,
    activation: activation.activation,
    phase: activation.phase,
    ...(record ? {
      index: record.index,
      total: activation.values.length,
      request_id: record.request_id,
    } : {}),
  };
}

export function shardStepEntries(parentStepId, parentStep, activation) {
  if (activation.phase === 'worker') {
    return [{
      id: parentStepId,
      action: 'run_worker',
      step: clone(parentStep),
      shard: publicShardContext(activation),
    }];
  }
  return currentShardRecords(activation).map((record) => ({
    id: record.request_id,
    parentStepId,
    action: 'run_worker',
    step: stepForShardWorker(parentStepId, parentStep, activation, record),
    shard: publicShardContext(activation, record),
  }));
}

export function startShardActivationWithRequests({ baton, parentStepId, parentStep }) {
  return activationWithCurrentShardRequests(startShardActivation({ baton, parentStepId, parentStep }));
}

export function currentShardActivationWithRequests({ baton, parentStepId }) {
  return activationWithCurrentShardRequests(currentShardActivation({ baton, parentStepId }));
}

export function shardRecordForRequest(activation, requestId) {
  return activation.shard_records.find((record) => record.request_id === requestId);
}

export function shardInterpolationContext({ baton, entry }) {
  const index = entry?.shard?.index;
  const parentStepId = entry?.shard?.parent_step_id;
  if (!Number.isInteger(index) || typeof parentStepId !== 'string') return undefined;
  const activation = baton?.state?.[SHARD_STATE_KEY]?.[parentStepId];
  if (!activation || index < 0 || index >= activation.values.length) return undefined;
  return {
    value: clone(activation.values[index]),
    index,
    total: activation.values.length,
  };
}
