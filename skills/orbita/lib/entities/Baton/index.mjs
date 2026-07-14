/**
 * Baton entity owns runtime cursor/status/state consistency and safe state updates.
 */
import { WorkflowRuntimeError } from '../../errors.mjs';
import { assertCentralArtifactMetadata } from './artifact-contract.mjs';
import { LOOP_PROGRESS_STATE_KEY, applyOutputToBatonState } from '../../runtime/baton-state.mjs';
import { normalizeCursor } from '../../runtime/cursor.mjs';
import { statusForStep } from '../../runtime/step-status.mjs';

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

function validateLoopProgress(state) {
  const progress = state[LOOP_PROGRESS_STATE_KEY];
  if (progress === undefined) return;
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    throw new WorkflowRuntimeError(`baton semantic validation failed: state.${LOOP_PROGRESS_STATE_KEY} must be an object of counters`);
  }
  for (const [policyId, value] of Object.entries(progress)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new WorkflowRuntimeError(`baton semantic validation failed: state.${LOOP_PROGRESS_STATE_KEY}.${policyId} must be a non-negative integer counter`);
    }
  }
}

export class Baton {
  constructor(batonData) {
    this.data = cloneBoundaryData(batonData);
    Object.freeze(this.data);
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
    return this.data.state?.[stepId];
  }

  pendingRequests() {
    return this.data.requests ?? [];
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
  validateLoopProgress(batonData.state);
  const stepId = normalizeCursor(batonData.cursor);
  const cursorStep = workflow.steps?.[stepId];
  if (!cursorStep) throw new WorkflowRuntimeError(`baton cursor not found in workflow: ${stepId}`);
  const expectedStatus = statusForStep(workflow, stepId, cursorStep);
  if (batonData.status !== expectedStatus) {
    throw new WorkflowRuntimeError(`baton status '${batonData.status}' is inconsistent with cursor '${batonData.cursor}'; expected '${expectedStatus}'`);
  }
  return { ok: true };
}
