import { constants } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { assertManagedRunStateFile } from './atomic-file.mjs';
import { currentRunStateLockToken } from './lock.mjs';
import { markValidatedPersistedBaton } from '../validated-baton.mjs';
import {
  PERSISTED_RUN_STATE_TOPOLOGY,
  PERSISTED_RUN_STATE_VERSION,
  assertPersistedRunState,
  commitMetadata,
} from './persisted-state-schema.mjs';

const snapshotMetadata = new WeakMap();

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function attachPersistedRunStateFileSnapshot(state, paths, files) {
  const persistedState = deepFreeze(assertPersistedRunState(state));
  markValidatedPersistedBaton(persistedState.baton);
  snapshotMetadata.set(persistedState, {
    lockToken: currentRunStateLockToken(paths),
    files: Object.freeze({
      history: Object.freeze({ ...files.history }),
      baton: Object.freeze({ ...files.baton }),
      currentRequests: Object.freeze({ ...files.currentRequests }),
    }),
  });
  return persistedState;
}

export function persistedRunStateLockToken(state) {
  return state && typeof state === 'object' ? snapshotMetadata.get(state)?.lockToken : undefined;
}

export function persistedRunStateFileSnapshot(state) {
  return state && typeof state === 'object' ? snapshotMetadata.get(state)?.files : undefined;
}

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

async function readJsonIfExists(path, name) {
  await assertManagedRunStateFile(path, name);
  if (!(await exists(path))) return undefined;
  let content;
  try { content = await readFile(path, 'utf8'); }
  catch (error) { throw new Error(`cannot read ${name} from ${path}: ${error.message}`); }
  try { return { content, value: JSON.parse(content) }; }
  catch (error) { throw new Error(`cannot parse ${name} from ${path}: ${error.message}`); }
}

async function readTextIfExists(path, name, { includeContent = true } = {}) {
  await assertManagedRunStateFile(path, name);
  if (!(await exists(path))) return undefined;
  try {
    if (!includeContent) return { size: (await stat(path)).size };
    const content = await readFile(path, 'utf8');
    return { content, size: Buffer.byteLength(content) };
  }
  catch (error) { throw new Error(`cannot read ${name} from ${path}: ${error.message}`); }
}

export async function readPersistedRunState(paths, { includeHistoryText = true } = {}) {
  const batonFile = await readJsonIfExists(paths.batonPath, 'baton');
  if (batonFile === undefined) throw new Error(`cannot read persisted run state: missing baton at ${paths.batonPath}`);
  const historyFile = await readTextIfExists(paths.historyPath, 'workflow history', { includeContent: includeHistoryText });
  const currentRequestsFile = paths.currentRequestsPath
    ? await readJsonIfExists(paths.currentRequestsPath, 'current workflow requests')
    : undefined;
  const baton = batonFile.value;
  const historyText = historyFile?.content;
  const currentRequestsDoc = currentRequestsFile?.value;
  const currentRequests = Array.isArray(currentRequestsDoc) ? currentRequestsDoc : currentRequestsDoc?.requests;
  const currentRequestsWorkflowSignature = Array.isArray(currentRequestsDoc) ? undefined : currentRequestsDoc?.workflowSignature;
  const currentRequestsBatonSignature = Array.isArray(currentRequestsDoc) ? undefined : currentRequestsDoc?.batonSignature;
  const pendingCommit = (await readJsonIfExists(paths.durableCommitPath, 'pending durable workflow commit'))?.value;
  const state = {
    version: PERSISTED_RUN_STATE_VERSION,
    storageTopology: PERSISTED_RUN_STATE_TOPOLOGY,
    run: { runDir: paths.runDir, workflowPath: paths.workflowPath, repositoryRoot: paths.repositoryRoot },
    baton,
    instructions: [],
    history: historyText === undefined
      ? { mode: 'file-ref', path: paths.historyPath }
      : { mode: 'embedded-text', path: paths.historyPath, text: historyText },
    currentRequests,
    commit: commitMetadata(pendingCommit),
  };
  if (currentRequestsWorkflowSignature !== undefined) state.currentRequestsWorkflowSignature = currentRequestsWorkflowSignature;
  if (currentRequestsBatonSignature !== undefined) state.currentRequestsBatonSignature = currentRequestsBatonSignature;
  return attachPersistedRunStateFileSnapshot(state, paths, {
    history: { exists: historyFile !== undefined, content: historyText, size: historyFile?.size ?? 0 },
    baton: { exists: true, content: batonFile.content },
    currentRequests: { exists: currentRequestsFile !== undefined, content: currentRequestsFile?.content },
  });
}
