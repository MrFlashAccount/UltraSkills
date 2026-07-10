import { assertBatonSchema } from '../../file-contracts/baton/baton-schema.mjs';

export const PERSISTED_RUN_STATE_VERSION = 1;
export const PERSISTED_RUN_STATE_TOPOLOGY = 'split-files-v1';

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string`);
}

function assertCommitSchema(commit) {
  if (commit === undefined) return;
  assertObject(commit, 'persisted run-state commit');
  if (![1, 2].includes(commit.version)) throw new Error('persisted run-state commit has unsupported version');
  assertString(commit.id, 'persisted run-state commit id');
  assertString(commit.createdAt, 'persisted run-state commit createdAt');
  if (!['pending', 'applying', 'applied'].includes(commit.status)) throw new Error('persisted run-state commit status is invalid');
  assertObject(commit.sideEffects, 'persisted run-state commit sideEffects');
  if (commit.version === 2 && Object.hasOwn(commit, 'historyAppend')) {
    assertObject(commit.historyAppend, 'persisted run-state commit historyAppend');
    if (typeof commit.historyAppend.baseExists !== 'boolean') {
      throw new Error('persisted run-state commit historyAppend.baseExists must be a boolean');
    }
    if (!Number.isSafeInteger(commit.historyAppend.baseSize) || commit.historyAppend.baseSize < 0) {
      throw new Error('persisted run-state commit historyAppend.baseSize must be a non-negative safe integer');
    }
    if (!commit.historyAppend.baseExists && commit.historyAppend.baseSize !== 0) {
      throw new Error('persisted run-state commit historyAppend.baseSize must be zero when the base file does not exist');
    }
    assertString(commit.historyAppend.transactionId, 'persisted run-state commit historyAppend.transactionId');
    assertString(commit.historyAppend.entryText, 'persisted run-state commit historyAppend.entryText');
    assertString(commit.historyAppend.entryHash, 'persisted run-state commit historyAppend.entryHash');
    if (commit.historyAppend.transactionId !== commit.id) throw new Error('persisted run-state commit historyAppend.transactionId must match commit id');
  }
}

function assertCurrentRequestsSchema(currentRequests, name = 'persisted run state currentRequests') {
  if (currentRequests === undefined) return;
  if (!Array.isArray(currentRequests)) throw new Error(`${name} must be an array`);
  for (const [index, request] of currentRequests.entries()) {
    assertObject(request, `${name}[${index}]`);
    assertString(request.id, `${name}[${index}].id`);
    assertString(request.action, `${name}[${index}].action`);
    if ('stepId' in request && typeof request.stepId !== 'string') throw new Error(`${name}[${index}].stepId must be a string`);
    if ('ownerStepId' in request && typeof request.ownerStepId !== 'string') throw new Error(`${name}[${index}].ownerStepId must be a string`);
  }
}

export function assertPersistedRunState(state, name = 'persisted run state') {
  assertObject(state, name);
  if (state.version !== PERSISTED_RUN_STATE_VERSION) throw new Error(`${name} has unsupported version`);
  if (state.storageTopology !== PERSISTED_RUN_STATE_TOPOLOGY) throw new Error(`${name} has unsupported storage topology`);
  assertObject(state.run, `${name} run`);
  assertString(state.run.runDir, `${name} run.runDir`);
  assertString(state.run.workflowPath, `${name} run.workflowPath`);
  assertString(state.run.repositoryRoot, `${name} run.repositoryRoot`);
  assertBatonSchema(state.baton);
  assertObject(state.history, `${name} history`);
  if (state.history.mode !== 'file-ref' && state.history.mode !== 'embedded-text') throw new Error(`${name} history mode is invalid`);
  if (state.history.mode === 'file-ref') assertString(state.history.path, `${name} history.path`);
  if (state.history.mode === 'embedded-text' && typeof state.history.text !== 'string') throw new Error(`${name} history.text must be a string`);
  if (!Array.isArray(state.instructions)) throw new Error(`${name} instructions must be an array`);
  for (const [index, instruction] of state.instructions.entries()) {
    assertObject(instruction, `${name} instructions[${index}]`);
    assertString(instruction.path, `${name} instructions[${index}].path`);
    if ('content' in instruction && typeof instruction.content !== 'string') throw new Error(`${name} instructions[${index}].content must be a string`);
    if (instruction.required === true && !('content' in instruction)) throw new Error(`${name} instructions[${index}].content must be present for committed instruction`);
  }
  assertCurrentRequestsSchema(state.currentRequests, `${name} currentRequests`);
  if ('currentRequestsWorkflowSignature' in state && typeof state.currentRequestsWorkflowSignature !== 'string') {
    throw new Error(`${name} currentRequestsWorkflowSignature must be a string`);
  }
  if ('currentRequestsBatonSignature' in state && typeof state.currentRequestsBatonSignature !== 'string') {
    throw new Error(`${name} currentRequestsBatonSignature must be a string`);
  }
  assertCommitSchema(state.commit);
  return state;
}

export function commitMetadata(commit) {
  if (!commit) return undefined;
  const sideEffects = {
    baton: Object.hasOwn(commit, 'baton'),
    history: typeof commit.historyText === 'string' || commit?.historyAppend?.entryText !== undefined,
    currentRequests: Object.hasOwn(commit, 'currentRequests'),
  };
  return {
    version: commit.version,
    id: commit.id,
    createdAt: commit.createdAt,
    status: commit.status ?? 'pending',
    sideEffects,
  };
}
