/** Applies current shard worker outputs or the normal final shard-step output. */
import { invariant } from '../errors.mjs';
import { applyOutputToBatonState } from './baton-state.mjs';
import {
  batonWithShardActivation,
  currentShardActivation,
  shardRecordForRequest,
  stepForShardWorker,
} from './shard.mjs';
import { assertOutputSchemaIfDeclared, readWorkerOutputForStep } from './output/worker-output.mjs';
import { responseForCursor } from './output/response.mjs';
import { applyNextTransition } from './transition/next.mjs';

function clone(value) {
  return structuredClone(value);
}

function outputForRequest(allOutput, requestId) {
  const steps = allOutput?.steps;
  invariant(steps && typeof steps === 'object' && !Array.isArray(steps), 'shard worker output must include object steps');
  invariant(Object.hasOwn(steps, requestId), `shard worker output missing current request '${requestId}'`);
  return steps[requestId];
}

function assertOnlyCurrentRequests(allOutput, activation) {
  const steps = allOutput?.steps;
  invariant(steps && typeof steps === 'object' && !Array.isArray(steps), 'shard worker output must include object steps');
  const current = new Set(activation.current_requests);
  for (const requestId of Object.keys(steps)) {
    invariant(current.has(requestId), `shard worker output included unexpected request '${requestId}'`);
  }
}

function acceptedRecord(record) {
  return {
    index: record.index,
    request_id: record.request_id,
    status: 'accepted',
    output_ref: { step_id: record.request_id },
  };
}

function nextActivationAfterBatch(activation, acceptedRequestIds) {
  const records = activation.shard_records.map((record) => acceptedRequestIds.has(record.request_id)
    ? { ...clone(record), status: 'accepted' }
    : clone(record));
  const allAccepted = records.every((record) => record.status === 'accepted');
  return {
    ...clone(activation),
    phase: allAccepted ? 'worker' : 'shards',
    status: allAccepted ? 'awaiting_worker' : 'awaiting_shards',
    current_requests: allAccepted ? [activation.parent_step_id] : [],
    shard_records: records,
  };
}

function retryResponseForShard(retryResponse, parentStepId, activation, record, acceptedRequestIds, acceptedOutputs) {
  const retryActivation = {
    ...nextActivationAfterBatch(activation, acceptedRequestIds),
    phase: 'shards',
    status: 'awaiting_shards',
    current_requests: [record.request_id],
    accepted_outputs: acceptedOutputs,
  };
  return {
    ...retryResponse,
    baton: batonWithShardActivation(retryResponse.baton, parentStepId, retryActivation),
    steps: retryResponse.steps.map((entry) => ({
      ...entry,
      parentStepId,
      shard: {
        parent_step_id: parentStepId,
        activation: activation.activation,
        phase: 'shards',
        index: record.index,
        total: activation.values.length,
        request_id: record.request_id,
      },
    })),
  };
}

function applyShardBatch({ workflow, baton, parentStepId, parentStep, activation, allOutput, resources }) {
  assertOnlyCurrentRequests(allOutput, activation);
  let updatedBaton = clone(baton);
  const acceptedRequestIds = new Set();
  const acceptedOutputs = clone(activation.accepted_outputs);

  for (const requestId of Object.keys(allOutput.steps)) {
    const record = shardRecordForRequest(activation, requestId);
    invariant(record, `shard activation '${parentStepId}' has no durable record for current request '${requestId}'`);
    const workerStep = stepForShardWorker(parentStepId, parentStep, activation, record);
    const validation = assertOutputSchemaIfDeclared({
      baton: updatedBaton,
      stepId: requestId,
      step: workerStep,
      workerOutput: outputForRequest(allOutput, requestId),
      resources,
    });
    if (validation.retryResponse) {
      return retryResponseForShard(
        validation.retryResponse,
        parentStepId,
        activation,
        record,
        acceptedRequestIds,
        acceptedOutputs,
      );
    }

    updatedBaton.state = applyOutputToBatonState(updatedBaton, validation.workerOutput, undefined, requestId);
    acceptedRequestIds.add(requestId);
    acceptedOutputs[String(record.index)] = acceptedRecord(record);
  }

  const nextActivation = {
    ...nextActivationAfterBatch(activation, acceptedRequestIds),
    accepted_outputs: acceptedOutputs,
  };
  updatedBaton = batonWithShardActivation(updatedBaton, parentStepId, nextActivation);
  return responseForCursor(updatedBaton, workflow);
}

function applyFinalWorkerOutput({ workflow, baton, parentStepId, parentStep, activation, candidateOutput, outputParseError, resources }) {
  const read = readWorkerOutputForStep({
    baton,
    stepId: parentStepId,
    step: parentStep,
    allOutput: candidateOutput,
    outputParseError,
  });
  if (read.retryResponse) return read.retryResponse;
  const validation = assertOutputSchemaIfDeclared({
    baton,
    stepId: parentStepId,
    step: parentStep,
    workerOutput: read.workerOutput,
    resources,
  });
  if (validation.retryResponse) return validation.retryResponse;

  const completedActivation = {
    ...clone(activation),
    phase: 'completed',
    status: 'completed',
    current_requests: [],
  };
  return applyNextTransition({
    workflow,
    baton: batonWithShardActivation(baton, parentStepId, completedActivation),
    cursorStep: parentStep,
    workerOutput: validation.workerOutput,
    stepId: parentStepId,
  });
}

export function applyShardStepOutput({ workflow, baton, parentStepId, parentStep, allOutput, outputParseError, resources }) {
  const activation = currentShardActivation({ baton, parentStepId });
  invariant(activation.parent_step_id === parentStepId, `shard activation parent mismatch for '${parentStepId}'`);
  if (activation.phase === 'shards') {
    return applyShardBatch({ workflow, baton, parentStepId, parentStep, activation, allOutput, resources });
  }
  invariant(activation.phase === 'worker', `shard step '${parentStepId}' cannot accept output in phase '${activation.phase}'`);
  return applyFinalWorkerOutput({
    workflow,
    baton,
    parentStepId,
    parentStep,
    activation,
    candidateOutput: allOutput,
    outputParseError,
    resources,
  });
}
