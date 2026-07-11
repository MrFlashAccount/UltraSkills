/** Applies current fanout branch outputs or the normal fanout owner output. */
import { invariant } from '../errors.mjs';
import { applyOutputToBatonState } from './baton-state.mjs';
import {
  FANOUT_STATE_KEY,
  batonWithFanoutActivation,
  branchRecordForRequest,
  fanoutActivationForBaton,
  stepForFanoutBranch,
} from './fanout.mjs';
import { assertOutputSchemaIfDeclared, readWorkerOutputForStep } from './output/worker-output.mjs';
import { responseForCursor } from './output/response.mjs';
import { applyNextTransition } from './transition/next.mjs';

function clone(value) {
  return structuredClone(value);
}

function outputForRequest(allOutput, requestId) {
  const steps = allOutput?.steps;
  invariant(steps && typeof steps === 'object' && !Array.isArray(steps), 'fanout branch output must include object steps');
  invariant(Object.hasOwn(steps, requestId), `fanout branch output missing current request '${requestId}'`);
  return steps[requestId];
}

function assertOnlyCurrentRequests(allOutput, activation) {
  const steps = allOutput?.steps;
  invariant(steps && typeof steps === 'object' && !Array.isArray(steps), 'fanout branch output must include object steps');
  const current = new Set(activation.current_requests);
  for (const requestId of Object.keys(steps)) {
    invariant(current.has(requestId), `fanout branch output included unexpected request '${requestId}'`);
  }
}

function acceptedRecord(record) {
  return {
    branch_id: record.branch_id,
    request_id: record.request_id,
    status: 'accepted',
    output_ref: { step_id: record.branch_id },
  };
}

function acceptedBranchRecords(records, acceptedRequestIds) {
  return records.map((record) => acceptedRequestIds.has(record.request_id)
    ? { ...clone(record), status: 'accepted' }
    : clone(record));
}

function nextActivationAfterBatch(activation, acceptedRequestIds) {
  const records = acceptedBranchRecords(activation.branch_records, acceptedRequestIds);
  const allAccepted = records.every((record) => record.status === 'accepted');
  return {
    ...clone(activation),
    phase: allAccepted ? 'owner' : 'branches',
    status: allAccepted ? 'awaiting_owner' : 'awaiting_branches',
    current_requests: allAccepted ? [activation.owner_step_id] : [],
    branch_records: records,
  };
}

function retryResponseForBranch(retryResponse, ownerStepId, activation, record, acceptedRequestIds, acceptedOutputs) {
  const retryActivation = {
    ...nextActivationAfterBatch(activation, acceptedRequestIds),
    phase: 'branches',
    status: 'awaiting_branches',
    current_requests: [record.request_id],
    accepted_outputs: acceptedOutputs,
  };
  return {
    ...retryResponse,
    baton: batonWithFanoutActivation(retryResponse.baton, ownerStepId, retryActivation),
    steps: retryResponse.steps.map((entry) => ({
      ...entry,
      ownerStepId,
      fanout: {
        owner_step_id: ownerStepId,
        activation: activation.activation,
        phase: 'branches',
        selected_branch_ids: [...activation.selected_branch_ids],
        branch_id: record.branch_id,
        request_id: record.request_id,
      },
    })),
  };
}

function applyBranchBatch({ workflow, baton, ownerStepId, ownerStep, activation, allOutput, resources }) {
  assertOnlyCurrentRequests(allOutput, activation);
  let updatedBaton = clone(baton);
  const acceptedRequestIds = new Set();
  const acceptedOutputs = clone(activation.accepted_outputs);

  for (const requestId of activation.current_requests) {
    const record = branchRecordForRequest(activation, requestId);
    invariant(record, `fanout activation '${ownerStepId}' has no durable branch record for current request '${requestId}'`);
    const branchStep = stepForFanoutBranch(ownerStepId, ownerStep, activation, record);
    const rawOutput = outputForRequest(allOutput, requestId);
    const validation = assertOutputSchemaIfDeclared({
      baton: updatedBaton,
      stepId: requestId,
      step: branchStep,
      workerOutput: rawOutput,
      resources,
    });
    if (validation.retryResponse) {
      return retryResponseForBranch(
        validation.retryResponse,
        ownerStepId,
        activation,
        record,
        acceptedRequestIds,
        acceptedOutputs,
      );
    }

    updatedBaton.state = applyOutputToBatonState(updatedBaton, validation.workerOutput, undefined, record.branch_id);
    delete updatedBaton.state[requestId];
    acceptedRequestIds.add(requestId);
    acceptedOutputs[record.branch_id] = acceptedRecord(record);
  }

  const nextActivation = {
    ...nextActivationAfterBatch(activation, acceptedRequestIds),
    accepted_outputs: acceptedOutputs,
  };
  updatedBaton = batonWithFanoutActivation(updatedBaton, ownerStepId, nextActivation);
  return responseForCursor(updatedBaton, workflow);
}

function applyOwnerOutput({ workflow, baton, ownerStepId, ownerStep, activation, candidateOutput, outputParseError, resources }) {
  const read = readWorkerOutputForStep({
    baton,
    stepId: ownerStepId,
    step: ownerStep,
    allOutput: candidateOutput,
    outputParseError,
  });
  if (read.retryResponse) return read.retryResponse;
  const validation = assertOutputSchemaIfDeclared({
    baton,
    stepId: ownerStepId,
    step: ownerStep,
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
  const withCompletedActivation = batonWithFanoutActivation(baton, ownerStepId, completedActivation);
  return applyNextTransition({
    workflow,
    baton: withCompletedActivation,
    cursorStep: ownerStep,
    workerOutput: validation.workerOutput,
    stepId: ownerStepId,
  });
}

export function applyFanoutStepOutput({ workflow, baton, ownerStepId, ownerStep, allOutput, outputParseError, resources }) {
  const activation = fanoutActivationForBaton({ baton, ownerStepId, ownerStep });
  invariant(activation.owner_step_id === ownerStepId, `fanout activation owner mismatch for '${ownerStepId}'`);
  if (activation.phase === 'branches') {
    return applyBranchBatch({ workflow, baton, ownerStepId, ownerStep, activation, allOutput, resources });
  }
  invariant(activation.phase === 'owner', `fanout step '${ownerStepId}' cannot accept output in phase '${activation.phase}'`);
  return applyOwnerOutput({
    workflow,
    baton,
    ownerStepId,
    ownerStep,
    activation,
    candidateOutput: allOutput,
    outputParseError,
    resources,
  });
}

export function fanoutActivationFromState(baton, ownerStepId) {
  return baton?.state?.[FANOUT_STATE_KEY]?.[ownerStepId];
}
