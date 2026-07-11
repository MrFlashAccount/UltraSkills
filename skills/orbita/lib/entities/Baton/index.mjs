/**
 * Baton entity owns runtime cursor/status/state consistency and safe state updates.
 */
import { WorkflowRuntimeError } from '../../errors.mjs';
import { assertCentralArtifactMetadata } from './artifact-contract.mjs';
import { LOOP_PROGRESS_STATE_KEY, applyOutputToBatonState } from '../../runtime/baton-state.mjs';
import { normalizeCursor } from '../../runtime/cursor.mjs';
import { statusForStep } from '../../runtime/step-status.mjs';
import { fanoutRequestId } from '../../runtime/fanout.mjs';
import { shardRequestId } from '../../runtime/shard.mjs';
import { deepFreeze } from '../../runtime/owned-snapshot.mjs';

function cloneBoundaryData(dto) {
  return typeof dto?.toJSON === 'function' ? dto.toJSON() : structuredClone(dto);
}

function workflowData(workflow) {
  return typeof workflow?.toJSON === 'function' ? workflow.toJSON() : workflow;
}


function aggregateArtifactIdentity(entry) {
  return `${entry.producerStepId}::${entry.artifact.id}`;
}

function validateAggregateArtifacts(state) {
  if (!Array.isArray(state.artifacts)) throw new WorkflowRuntimeError('baton semantic validation failed: state.artifacts must be array');
  const seen = new Map();
  for (const [index, entry] of state.artifacts.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.producerStepId !== 'string' || !entry.producerStepId || !entry.artifact || typeof entry.artifact !== 'object' || Array.isArray(entry.artifact)) {
      throw new WorkflowRuntimeError(`baton semantic validation failed: state.artifacts/${index} must be aggregate artifact {producerStepId, artifact}`);
    }
    for (const field of Object.keys(entry)) {
      if (!['producerStepId', 'artifact'].includes(field)) throw new WorkflowRuntimeError(`baton semantic validation failed: state.artifacts/${index}/${field} is not allowed`);
    }
    assertCentralArtifactMetadata(entry.artifact, `state.artifacts/${index}/artifact`, { errorPrefix: 'baton semantic validation failed' });
    const identity = aggregateArtifactIdentity(entry);
    if (seen.has(identity)) {
      throw new WorkflowRuntimeError(
        `baton semantic validation failed: duplicate state.artifacts identity {producerStepId: '${entry.producerStepId}', artifact.id: '${entry.artifact.id}'} at entries ${seen.get(identity)} and ${index}`,
      );
    }
    seen.set(identity, index);
  }
}

function validateLoopProgress(state, workflow) {
  const progress = state[LOOP_PROGRESS_STATE_KEY];
  if (progress === undefined) return;
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    throw new WorkflowRuntimeError(`baton semantic validation failed: state.${LOOP_PROGRESS_STATE_KEY} must be an object of counters`);
  }
  for (const [policyId, value] of Object.entries(progress)) {
    const policy = workflow.loopPolicies?.[policyId];
    if (!policy) {
      throw new WorkflowRuntimeError(`baton semantic validation failed: state.${LOOP_PROGRESS_STATE_KEY}.${policyId} does not identify a workflow loop policy`);
    }
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new WorkflowRuntimeError(`baton semantic validation failed: state.${LOOP_PROGRESS_STATE_KEY}.${policyId} must be a non-negative safe integer counter`);
    }
    if (value > policy.maxIterations) {
      throw new WorkflowRuntimeError(`baton semantic validation failed: state.${LOOP_PROGRESS_STATE_KEY}.${policyId} must not exceed loopPolicy maxIterations ${policy.maxIterations}`);
    }
  }
}

function semanticFail(message) {
  throw new WorkflowRuntimeError(`baton semantic validation failed: ${message}`);
}

function assertCurrentRequests(activation, allowed, ownerRequestId, expectedPhase) {
  const current = activation.current_requests;
  if (new Set(current).size !== current.length) semanticFail('activation current_requests must be unique');
  if (expectedPhase === 'children') {
    if (current.length > activation.max_parallel) semanticFail('activation current_requests exceeds max_parallel');
    for (const requestId of current) {
      if (!allowed.has(requestId)) semanticFail(`activation current request '${requestId}' is not a pending child request`);
    }
    return;
  }
  const expected = expectedPhase === 'owner' ? [ownerRequestId] : [];
  if (current.length !== expected.length || current.some((value, index) => value !== expected[index])) {
    semanticFail(`activation current_requests is inconsistent with phase '${activation.phase}'`);
  }
}

function validateFanoutActivations(state, workflow) {
  for (const [ownerStepId, activation] of Object.entries(state.fanouts ?? {})) {
    const ownerStep = workflow.steps?.[ownerStepId];
    if (ownerStep?.kind !== 'fanout') semanticFail(`state.fanouts.${ownerStepId} does not identify a fanout workflow step`);
    if (activation.owner_step_id !== ownerStepId) semanticFail(`state.fanouts.${ownerStepId}.owner_step_id must equal its state key`);
    const selected = activation.selected_branch_ids;
    const records = activation.branch_records;
    if (records.length !== selected.length) semanticFail(`state.fanouts.${ownerStepId}.branch_records must match selected_branch_ids cardinality`);
    const acceptedKeys = new Set(Object.keys(activation.accepted_outputs));
    const pendingRequests = new Set();
    const recordIdentities = new Set();
    for (const [index, branchId] of selected.entries()) {
      if (!Object.hasOwn(ownerStep.branches ?? {}, branchId)) semanticFail(`state.fanouts.${ownerStepId} selects unknown branch '${branchId}'`);
      const record = records[index];
      const requestId = fanoutRequestId(ownerStepId, activation.activation, branchId);
      if (record.branch_id !== branchId || record.request_id !== requestId) semanticFail(`state.fanouts.${ownerStepId}.branch_records/${index} has non-deterministic identity`);
      if (recordIdentities.has(requestId)) semanticFail(`state.fanouts.${ownerStepId}.branch_records contains duplicate identity '${requestId}'`);
      recordIdentities.add(requestId);
      const accepted = activation.accepted_outputs[branchId];
      if (record.status === 'accepted') {
        if (!accepted || accepted.branch_id !== branchId || accepted.request_id !== requestId || accepted.status !== 'accepted' || accepted.output_ref?.step_id !== branchId) {
          semanticFail(`state.fanouts.${ownerStepId} accepted branch '${branchId}' lacks matching accepted_outputs record`);
        }
        if (!Object.hasOwn(state, branchId)) semanticFail(`state.fanouts.${ownerStepId} accepted branch '${branchId}' lacks retained output state`);
        acceptedKeys.delete(branchId);
      } else {
        if (accepted) semanticFail(`state.fanouts.${ownerStepId} pending branch '${branchId}' has accepted output metadata`);
        pendingRequests.add(requestId);
      }
    }
    if (acceptedKeys.size > 0) semanticFail(`state.fanouts.${ownerStepId}.accepted_outputs contains unknown branch '${[...acceptedKeys][0]}'`);
    const allAccepted = pendingRequests.size === 0;
    if (activation.phase === 'branches') {
      if (activation.status !== 'awaiting_branches' || allAccepted) semanticFail(`state.fanouts.${ownerStepId} branches phase/status requires pending branch work`);
      assertCurrentRequests(activation, pendingRequests, ownerStepId, 'children');
    } else if (activation.phase === 'owner') {
      if (activation.status !== 'awaiting_owner' || !allAccepted) semanticFail(`state.fanouts.${ownerStepId} owner phase requires all branches accepted`);
      assertCurrentRequests(activation, pendingRequests, ownerStepId, 'owner');
    } else if (activation.phase === 'completed') {
      if (activation.status !== 'completed' || !allAccepted) semanticFail(`state.fanouts.${ownerStepId} completed phase requires all branches accepted`);
      assertCurrentRequests(activation, pendingRequests, ownerStepId, 'completed');
    } else semanticFail(`state.fanouts.${ownerStepId} has unknown phase '${activation.phase}'`);
  }
}

function validateShardActivations(state, workflow) {
  for (const [parentStepId, activation] of Object.entries(state.shards ?? {})) {
    const parentStep = workflow.steps?.[parentStepId];
    if (parentStep?.kind !== 'shard') semanticFail(`state.shards.${parentStepId} does not identify a shard workflow step`);
    if (activation.parent_step_id !== parentStepId) semanticFail(`state.shards.${parentStepId}.parent_step_id must equal its state key`);
    const records = activation.shard_records;
    if (records.length !== activation.values.length) semanticFail(`state.shards.${parentStepId}.shard_records must match values cardinality`);
    const acceptedKeys = new Set(Object.keys(activation.accepted_outputs));
    const pendingRequests = new Set();
    const recordIdentities = new Set();
    for (const [index, record] of records.entries()) {
      const requestId = shardRequestId(parentStepId, activation.activation, index);
      if (record.index !== index || record.request_id !== requestId) semanticFail(`state.shards.${parentStepId}.shard_records/${index} has non-deterministic identity`);
      if (recordIdentities.has(requestId)) semanticFail(`state.shards.${parentStepId}.shard_records contains duplicate identity '${requestId}'`);
      recordIdentities.add(requestId);
      const accepted = activation.accepted_outputs[String(index)];
      if (record.status === 'accepted') {
        if (!accepted || accepted.index !== index || accepted.request_id !== requestId || accepted.status !== 'accepted' || accepted.output_ref?.step_id !== requestId) {
          semanticFail(`state.shards.${parentStepId} accepted shard ${index} lacks matching accepted_outputs record`);
        }
        if (!Object.hasOwn(state, requestId)) semanticFail(`state.shards.${parentStepId} accepted shard ${index} lacks retained output state`);
        acceptedKeys.delete(String(index));
      } else {
        if (accepted) semanticFail(`state.shards.${parentStepId} pending shard ${index} has accepted output metadata`);
        pendingRequests.add(requestId);
      }
    }
    if (acceptedKeys.size > 0) semanticFail(`state.shards.${parentStepId}.accepted_outputs contains unknown shard '${[...acceptedKeys][0]}'`);
    const allAccepted = pendingRequests.size === 0;
    if (activation.phase === 'shards') {
      if (activation.status !== 'awaiting_shards' || allAccepted) semanticFail(`state.shards.${parentStepId} shards phase/status requires pending shard work`);
      assertCurrentRequests(activation, pendingRequests, parentStepId, 'children');
    } else if (activation.phase === 'worker') {
      if (activation.status !== 'awaiting_worker' || !allAccepted) semanticFail(`state.shards.${parentStepId} worker phase requires all shards accepted`);
      assertCurrentRequests(activation, pendingRequests, parentStepId, 'owner');
    } else if (activation.phase === 'completed') {
      if (activation.status !== 'completed' || !allAccepted) semanticFail(`state.shards.${parentStepId} completed phase requires all shards accepted`);
      assertCurrentRequests(activation, pendingRequests, parentStepId, 'completed');
    } else semanticFail(`state.shards.${parentStepId} has unknown phase '${activation.phase}'`);
  }
}

export class Baton {
  constructor(batonData) {
    this.data = cloneBoundaryData(batonData);
    deepFreeze(this.data);
  }

  toJSON() {
    return structuredClone(this.data);
  }

  validateAgainst(workflowInput) {
    return validateBatonDataAgainstWorkflow(this.data, workflowInput);
  }

  currentCursor() {
    return this.data.cursor;
  }

  status() {
    return this.data.status;
  }

  hasOutput(stepId) {
    return Boolean(this.data.state && Object.hasOwn(this.data.state, stepId));
  }

  outputFor(stepId) {
    const output = this.data.state?.[stepId];
    return output === undefined ? undefined : structuredClone(output);
  }

  pendingRequests() {
    return structuredClone(this.data.requests ?? []);
  }

  withAppliedOutput(stepId, output, attempts) {
    const baton = this.toJSON();
    const state = applyOutputToBatonState(baton, output, attempts, stepId);
    return { ...baton, state };
  }
}

export function validateBatonDataAgainstWorkflow(batonData, workflowInput) {
  const workflow = workflowData(workflowInput);
  if (typeof batonData.status !== 'string' || !batonData.state || typeof batonData.state !== 'object' || Array.isArray(batonData.state)) {
    throw new WorkflowRuntimeError('baton semantic validation failed: baton requires cursor, status, and object state');
  }
  validateAggregateArtifacts(batonData.state);
  validateLoopProgress(batonData.state, workflow);
  validateFanoutActivations(batonData.state, workflow);
  validateShardActivations(batonData.state, workflow);
  const stepId = normalizeCursor(batonData.cursor);
  const cursorStep = workflow.steps?.[stepId];
  if (!cursorStep) throw new WorkflowRuntimeError(`baton cursor not found in workflow: ${stepId}`);
  const expectedStatus = statusForStep(workflow, stepId, cursorStep);
  if (batonData.status !== expectedStatus) {
    throw new WorkflowRuntimeError(`baton status '${batonData.status}' is inconsistent with cursor '${batonData.cursor}'; expected '${expectedStatus}'`);
  }
  return { ok: true };
}
