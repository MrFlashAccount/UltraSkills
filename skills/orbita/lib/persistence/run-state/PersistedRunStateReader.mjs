import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { assertManagedRunStateFile } from './atomic-file.mjs';
import {
  PERSISTED_RUN_STATE_TOPOLOGY,
  PERSISTED_RUN_STATE_VERSION,
  assertPersistedRunState,
  commitMetadata,
} from './persisted-state-schema.mjs';

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

async function readJsonIfExists(path, name) {
  await assertManagedRunStateFile(path, name);
  if (!(await exists(path))) return undefined;
  let content;
  try { content = await readFile(path, 'utf8'); }
  catch (error) { throw new Error(`cannot read ${name} from ${path}: ${error.message}`); }
  try { return JSON.parse(content); }
  catch (error) { throw new Error(`cannot parse ${name} from ${path}: ${error.message}`); }
}

async function readTextIfExists(path, name) {
  await assertManagedRunStateFile(path, name);
  if (!(await exists(path))) return undefined;
  try { return await readFile(path, 'utf8'); }
  catch (error) { throw new Error(`cannot read ${name} from ${path}: ${error.message}`); }
}

export async function readPersistedRunState(paths) {
  const baton = await readJsonIfExists(paths.batonPath, 'baton');
  if (baton === undefined) throw new Error(`cannot read persisted run state: missing baton at ${paths.batonPath}`);
  const historyText = await readTextIfExists(paths.historyPath, 'workflow history');
  const currentRequestsDoc = paths.currentRequestsPath
    ? await readJsonIfExists(paths.currentRequestsPath, 'current workflow requests')
    : undefined;
  const currentRequests = Array.isArray(currentRequestsDoc) ? currentRequestsDoc : currentRequestsDoc?.requests;
  const currentRequestsWorkflowSignature = Array.isArray(currentRequestsDoc) ? undefined : currentRequestsDoc?.workflowSignature;
  const currentRequestsBatonSignature = Array.isArray(currentRequestsDoc) ? undefined : currentRequestsDoc?.batonSignature;
  const pendingCommit = await readJsonIfExists(paths.durableCommitPath, 'pending durable workflow commit');
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
  return assertPersistedRunState(state);
}
