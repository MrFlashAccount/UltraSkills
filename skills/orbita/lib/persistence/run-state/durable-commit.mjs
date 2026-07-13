import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { access, open, readFile, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  PERSISTED_RUN_STATE_TOPOLOGY,
  PERSISTED_RUN_STATE_VERSION,
  assertPersistedRunState,
} from './persisted-state-schema.mjs';
import {
  attachPersistedRunStateFileSnapshot,
  persistedRunStateFileSnapshot,
  readPersistedRunState,
} from './PersistedRunStateReader.mjs';
import { assertManagedRunStateFile, writeJsonAtomic, writeTextAtomic } from './atomic-file.mjs';
import { durableFileSignature } from './file-signature.mjs';

async function exists(path) { try { await access(path, constants.F_OK); return true; } catch { return false; } }

async function readJson(path, name) {
  let content;
  try { content = await readFile(path, 'utf8'); }
  catch (error) { throw new Error(`cannot read ${name} from ${path}: ${error.message}`); }
  try { return JSON.parse(content); }
  catch (error) { throw new Error(`cannot parse ${name} from ${path}: ${error.message}`); }
}

async function fileSizeIfExists(pathname) {
  try { return (await stat(pathname)).size; }
  catch (error) {
    if (error?.code === 'ENOENT') return 0;
    throw error;
  }
}

function jsonFileContent(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Supplies the absent-file snapshot used by the first atomic durable commit. */
function initialPersistedRunState(paths, baton) {
  return attachPersistedRunStateFileSnapshot({
    version: PERSISTED_RUN_STATE_VERSION,
    storageTopology: PERSISTED_RUN_STATE_TOPOLOGY,
    run: { runDir: paths.runDir, workflowPath: paths.workflowPath, repositoryRoot: paths.repositoryRoot },
    baton,
    instructions: [],
    history: { mode: 'file-ref', path: paths.historyPath },
    currentRequests: undefined,
    commit: undefined,
  }, paths, {
    history: { exists: false, content: undefined, size: 0 },
    baton: { exists: false, content: undefined },
    currentRequests: { exists: false, content: undefined },
  });
}

function historyEntry({ source, baton, requests, steps, output, decision, details }, { transactionId } = {}) {
  const lines = [`## ${new Date().toISOString()}`, '', `- source: ${source}`, `- baton: cursor=${baton.cursor ?? 'unknown'} status=${baton.status ?? 'unknown'}`];
  if (transactionId) lines.splice(3, 0, `- transaction: ${transactionId}`);
  if (steps?.length) lines.push(`- steps: ${steps.map((step) => `id=${step.id} action=${step.action}`).join('; ')}`);
  else if (requests?.length) lines.push(`- requests: ${requests.map((request) => `id=${request.id} action=${request.action}`).join('; ')}`);
  if (output) lines.push(`- output: ${output}`);
  if (decision) lines.push(`- decision: ${decision}`);
  if (Array.isArray(details)) lines.push(...details.filter((line) => typeof line === 'string' && line.length > 0));
  lines.push('', '');
  return lines.join('\n');
}

function maybeFailDurableCommitAfter(action) {
  if (process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER === action) throw new Error(`injected durable commit failure after ${action}`);
}

async function readTextIfExists(path) {
  try {
    await assertManagedRunStateFile(path);
    return { exists: true, content: await readFile(path, 'utf8') };
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, content: undefined };
    throw error;
  }
}

async function restoreTextSnapshot(path, snapshot) {
  await assertManagedRunStateFile(path);
  if (snapshot.exists) await writeTextAtomic(path, snapshot.content);
  else await rm(path, { force: true });
}

async function openManagedHistoryFile(path, { create = false } = {}) {
  await assertManagedRunStateFile(path, 'workflow history');
  const noFollow = constants.O_NOFOLLOW ?? 0;
  let handle;
  try {
    handle = await open(path, constants.O_RDWR | noFollow, 0o600);
  } catch (error) {
    if (!create || error?.code !== 'ENOENT') throw error;
    handle = await open(path, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
  }
  const stats = await handle.stat();
  if (!stats.isFile()) {
    await handle.close();
    throw new Error('workflow history is unsafe because it is not a regular file');
  }
  return handle;
}

async function readBuffer(handle, length, position) {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, position + offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return buffer.subarray(0, offset);
}

async function writeBuffer(handle, buffer, position) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset, position + offset);
    if (bytesWritten === 0) throw new Error('workflow history append made no progress');
    offset += bytesWritten;
  }
}

function assertHistoryAppend(historyAppend, commitId) {
  if (!historyAppend || typeof historyAppend !== 'object' || Array.isArray(historyAppend)) throw new Error('pending durable workflow commit historyAppend must be an object');
  if (typeof historyAppend.baseExists !== 'boolean') throw new Error('pending durable workflow commit historyAppend.baseExists must be a boolean');
  if (!Number.isSafeInteger(historyAppend.baseSize) || historyAppend.baseSize < 0) throw new Error('pending durable workflow commit historyAppend.baseSize must be a non-negative safe integer');
  if (!historyAppend.baseExists && historyAppend.baseSize !== 0) throw new Error('pending durable workflow commit historyAppend.baseSize must be zero when the base file does not exist');
  if (typeof historyAppend.entryText !== 'string' || historyAppend.entryText.length === 0) throw new Error('pending durable workflow commit historyAppend.entryText must be a non-empty string');
  if (historyAppend.transactionId !== commitId) throw new Error('pending durable workflow commit historyAppend.transactionId must match commit id');
  const expectedHash = createHash('sha256').update(historyAppend.entryText).digest('hex');
  if (historyAppend.entryHash !== expectedHash) throw new Error('pending durable workflow commit historyAppend.entryHash is invalid');
  return historyAppend;
}

async function applyHistoryAppend(path, historyAppend, { beforeModify } = {}) {
  const entry = Buffer.from(historyAppend.entryText);
  const expectedSize = historyAppend.baseSize + entry.length;
  const handle = await openManagedHistoryFile(path, { create: historyAppend.baseSize === 0 });
  try {
    const currentSize = (await handle.stat()).size;
    if (currentSize < historyAppend.baseSize || currentSize > expectedSize) {
      throw new Error(`workflow history size does not match pending transaction ${historyAppend.transactionId}`);
    }
    const tailLength = currentSize - historyAppend.baseSize;
    const tail = await readBuffer(handle, tailLength, historyAppend.baseSize);
    if (tail.length !== tailLength || !tail.equals(entry.subarray(0, tailLength))) {
      throw new Error(`workflow history tail does not match pending transaction ${historyAppend.transactionId}`);
    }
    if (tailLength < entry.length) {
      beforeModify?.();
      await handle.truncate(historyAppend.baseSize);
      await writeBuffer(handle, entry, historyAppend.baseSize);
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function restoreHistorySnapshot(path, snapshot) {
  await assertManagedRunStateFile(path, 'workflow history');
  if (!snapshot.exists) {
    await rm(path, { force: true });
    return;
  }
  if (typeof snapshot.content === 'string') {
    await writeTextAtomic(path, snapshot.content);
    return;
  }
  const handle = await openManagedHistoryFile(path);
  try {
    await handle.truncate(snapshot.size);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function snapshotDurableTargets(paths, { historySnapshot } = {}) {
  return {
    history: historySnapshot ?? await readTextIfExists(paths.historyPath),
    baton: await readTextIfExists(paths.batonPath),
    currentRequests: await readTextIfExists(paths.currentRequestsPath),
  };
}

async function restoreDurableTargets(paths, snapshot) {
  await restoreHistorySnapshot(paths.historyPath, snapshot.history);
  await restoreTextSnapshot(paths.batonPath, snapshot.baton);
  await restoreTextSnapshot(paths.currentRequestsPath, snapshot.currentRequests);
}

async function recoverDurableCommitState(paths, { before: suppliedBefore, includeHistoryText = true, readResultState = true } = {}) {
  if (!(await exists(paths.durableCommitPath))) return { recovered: false, state: undefined };
  await assertManagedRunStateFile(paths.durableCommitPath, 'pending durable workflow commit');
  const commit = await readJson(paths.durableCommitPath, 'pending durable workflow commit');
  if (![1, 2].includes(commit?.version)) throw new Error(`unsupported durable workflow commit version in ${paths.durableCommitPath}`);
  const historyAppend = commit.version === 2 ? assertHistoryAppend(commit.historyAppend, commit.id) : undefined;

  const before = suppliedBefore ?? await snapshotDurableTargets(paths, {
    historySnapshot: historyAppend
      ? { exists: historyAppend.baseExists, size: historyAppend.baseSize }
      : undefined,
  });
  let targetsTouched = false;
  let appliedCurrentRequestsBatonSignature;
  try {
    await writeJsonAtomic(paths.durableCommitPath, { ...commit, status: 'applying' });
    if (typeof commit.historyText === 'string') {
      targetsTouched = true;
      await writeTextAtomic(paths.historyPath, commit.historyText);
    } else if (historyAppend) {
      await applyHistoryAppend(paths.historyPath, historyAppend, { beforeModify: () => { targetsTouched = true; } });
    }
    maybeFailDurableCommitAfter('history');
    if (Object.hasOwn(commit, 'baton')) {
      targetsTouched = true;
      await writeJsonAtomic(paths.batonPath, commit.baton);
    }
    maybeFailDurableCommitAfter('baton');
    if (Object.hasOwn(commit, 'currentRequests')) {
      targetsTouched = true;
      appliedCurrentRequestsBatonSignature = commit.version === 2
        ? await durableFileSignature(paths.batonPath)
        : commit.currentRequestsBatonSignature;
      await writeJsonAtomic(paths.currentRequestsPath, {
        workflowSignature: commit.currentRequestsWorkflowSignature,
        batonSignature: appliedCurrentRequestsBatonSignature,
        requests: commit.currentRequests,
      });
    }
    maybeFailDurableCommitAfter('currentRequests');
    await rm(paths.durableCommitPath, { force: true });
    if (!readResultState) return { recovered: true, state: undefined, currentRequestsBatonSignature: appliedCurrentRequestsBatonSignature };
    const state = assertPersistedRunState(await readPersistedRunState(paths, { includeHistoryText }), 'persisted run state after recovery');
    return { recovered: true, state, currentRequestsBatonSignature: appliedCurrentRequestsBatonSignature };
  } catch (error) {
    if (targetsTouched) await restoreDurableTargets(paths, before);
    throw error;
  }
}

export async function recoverDurableCommit(paths, { includeHistoryText = false } = {}) {
  return (await recoverDurableCommitState(paths, { includeHistoryText })).recovered;
}

function nextPersistedRunState(current, { baton, historyEntryText, currentRequests, currentRequestsWorkflowSignature, currentRequestsBatonSignature, writeBaton = true }, commit) {
  const history = current.history.mode === 'embedded-text'
    ? { ...current.history, text: `${current.history.text}${historyEntryText}` }
    : current.history;
  const state = {
    ...current,
    baton: writeBaton ? baton : current.baton,
    instructions: [],
    history,
    currentRequests: currentRequests !== undefined ? currentRequests : current.currentRequests,
    commit: { version: commit.version, id: commit.id, createdAt: commit.createdAt, status: 'pending', sideEffects: { baton: writeBaton, history: true, currentRequests: currentRequests !== undefined } },
  };
  const workflowSignature = currentRequestsWorkflowSignature ?? current.currentRequestsWorkflowSignature;
  if (workflowSignature !== undefined) state.currentRequestsWorkflowSignature = workflowSignature;
  const batonSignature = currentRequestsBatonSignature ?? current.currentRequestsBatonSignature;
  if (batonSignature !== undefined) state.currentRequestsBatonSignature = batonSignature;
  return state;
}

function assertCurrentStateForPaths(currentState, paths) {
  const current = persistedRunStateFileSnapshot(currentState)
    ? currentState
    : assertPersistedRunState(currentState, 'current persisted run state');
  if (
    resolve(current.run.runDir) !== resolve(paths.runDir)
    || resolve(current.run.workflowPath) !== resolve(paths.workflowPath)
    || resolve(current.run.repositoryRoot) !== resolve(paths.repositoryRoot)
  ) {
    throw new Error('current persisted run-state snapshot does not belong to the target run');
  }
  return current;
}

function appliedPersistedRunState(paths, pendingState, currentFiles, {
  baton,
  historyEntryText,
  historyBaseSize,
  currentRequests,
  currentRequestsWorkflowSignature,
  currentRequestsBatonSignature,
  writeBaton,
}) {
  const { commit: _commit, ...state } = pendingState;
  if (currentRequests !== undefined) state.currentRequestsBatonSignature = currentRequestsBatonSignature;
  const historyContent = typeof currentFiles.history.content === 'string'
    ? `${currentFiles.history.content}${historyEntryText}`
    : undefined;
  const currentRequestsContent = currentRequests === undefined
    ? currentFiles.currentRequests.content
    : jsonFileContent({
      workflowSignature: currentRequestsWorkflowSignature,
      batonSignature: currentRequestsBatonSignature,
      requests: currentRequests,
    });
  return attachPersistedRunStateFileSnapshot(state, paths, {
    history: {
      exists: true,
      content: historyContent,
      size: historyBaseSize + Buffer.byteLength(historyEntryText),
    },
    baton: {
      exists: true,
      content: writeBaton ? jsonFileContent(baton) : currentFiles.baton.content,
    },
    currentRequests: {
      exists: currentRequests !== undefined || currentFiles.currentRequests.exists,
      content: currentRequestsContent,
    },
  });
}

export async function commitDurableRunState(paths, { baton, history, currentRequests, writeBaton = true }, { currentState } = {}) {
  const includeHistoryText = currentState?.history?.mode !== 'file-ref';
  const recovery = await recoverDurableCommitState(paths, { includeHistoryText });
  const current = recovery.state
    ?? (currentState === undefined
      ? (await exists(paths.batonPath)
        ? await readPersistedRunState(paths, { includeHistoryText })
        : initialPersistedRunState(paths, baton))
      : assertCurrentStateForPaths(currentState, paths));
  if (!(await exists(paths.batonPath)) && !writeBaton) {
    throw new Error('initial durable workflow commit must write the baton');
  }
  const currentFiles = persistedRunStateFileSnapshot(current);
  const historyBaseSize = currentFiles?.history?.size ?? await fileSizeIfExists(paths.historyPath);
  const historyBaseExists = currentFiles?.history?.exists ?? await exists(paths.historyPath);
  const commitId = randomUUID();
  const historyEntryText = historyEntry(history, { transactionId: commitId });
  const currentRequestsWorkflowSignature = currentRequests !== undefined
    ? await durableFileSignature(paths.workflowPath)
    : undefined;
  const currentRequestsBatonSignature = currentRequests !== undefined && await exists(paths.batonPath)
    ? await durableFileSignature(paths.batonPath)
    : undefined;
  const commit = {
    version: 2,
    id: commitId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    historyAppend: {
      transactionId: commitId,
      baseExists: historyBaseExists,
      baseSize: historyBaseSize,
      entryText: historyEntryText,
      entryHash: createHash('sha256').update(historyEntryText).digest('hex'),
    },
    sideEffects: { baton: writeBaton, history: true, currentRequests: currentRequests !== undefined },
  };
  if (writeBaton) commit.baton = baton;
  if (currentRequests !== undefined) {
    commit.currentRequests = currentRequests;
    commit.currentRequestsWorkflowSignature = currentRequestsWorkflowSignature;
  }
  const pendingState = assertPersistedRunState(nextPersistedRunState(current, {
    baton,
    historyEntryText,
    currentRequests,
    currentRequestsWorkflowSignature,
    currentRequestsBatonSignature,
    writeBaton,
  }, commit), 'next persisted run state');
  await writeJsonAtomic(paths.durableCommitPath, commit);
  maybeFailDurableCommitAfter('pending');
  const canBuildAppliedState = currentFiles !== undefined;
  const applied = await recoverDurableCommitState(paths, {
    before: currentFiles,
    includeHistoryText,
    readResultState: !canBuildAppliedState,
  });
  if (!applied.recovered) throw new Error('pending durable workflow commit was not applied');
  if (applied.state) return applied.state;
  return appliedPersistedRunState(paths, pendingState, currentFiles, {
    baton,
    historyEntryText,
    historyBaseSize,
    currentRequests,
    currentRequestsWorkflowSignature,
    currentRequestsBatonSignature: currentRequests === undefined
      ? currentRequestsBatonSignature
      : applied.currentRequestsBatonSignature,
    writeBaton,
  });
}

export async function appendHistory(paths, entry) {
  await assertManagedRunStateFile(paths.historyPath, 'workflow history');
  const handle = await open(paths.historyPath, 'a', 0o600);
  try {
    await handle.writeFile(historyEntry(entry), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function appendHistoryOnce(paths, entry, { dedupeKey } = {}) {
  if (typeof dedupeKey !== 'string' || dedupeKey.length === 0) return appendHistory(paths, entry);
  const digest = createHash('sha256').update(dedupeKey).digest('hex');
  const markerPath = join(paths.runnerDir, `history-entry-${digest}.marker`);
  await assertManagedRunStateFile(markerPath, 'workflow history dedupe marker');
  if (await exists(markerPath)) return false;
  await appendHistory(paths, entry);
  try {
    const handle = await open(markerPath, 'wx', 0o600);
    await handle.close();
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
  return true;
}
