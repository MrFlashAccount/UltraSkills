import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertManagedDirectory,
  assertManagedRunStateFile,
  createManagedDirectory,
  writeJsonAtomic,
} from './atomic-file.mjs';
import { readRunsIndex, runsIndexPathsForRoot } from './run-index.mjs';
import { assertRunAuthoritySchema } from './schema/run-authority-schema.mjs';
import { currentRunStateLockToken } from './lock.mjs';

export const RUN_AUTHORITY_SCHEMA_VERSION = 1;
export const RUN_AUTHORITY_TOPOLOGY_VERSION = 'run-authority-v1';

function pruneUndefinedProperties(value) {
  for (const key of Object.keys(value)) if (value[key] === undefined) delete value[key];
  return value;
}

export function assertRunAuthority(authority, paths) {
  assertRunAuthoritySchema(authority);
  if (paths && authority.runId !== paths.runId) {
    throw new Error(`run authority entry mismatch for ${paths.runId}`);
  }
  if (resolve(authority.workflow.path) !== authority.workflow.path) {
    throw new Error('run authority workflow path must be absolute');
  }
  return authority;
}

export function runAuthorityRecord(paths, {
  workflowIdentity,
  status = 'running',
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  taskKey,
  taskFingerprint,
  claimContext,
  workerLease = null,
} = {}) {
  const authority = {
    schemaVersion: RUN_AUTHORITY_SCHEMA_VERSION,
    topologyVersion: RUN_AUTHORITY_TOPOLOGY_VERSION,
    runId: paths.runId,
    workflow: pruneUndefinedProperties({
      identity: workflowIdentity,
      path: resolve(paths.workflowPath),
    }),
    status,
    createdAt,
    updatedAt,
    taskKey,
    taskFingerprint,
    claimContext,
    workerLease,
  };
  pruneUndefinedProperties(authority);
  return assertRunAuthority(authority, paths);
}

export function runAuthorityFromIndexEntry(paths, entry) {
  if (!entry) return undefined;
  const authorityPaths = { ...paths, workflowPath: resolve(entry.workflow.path) };
  return runAuthorityRecord(authorityPaths, {
    workflowIdentity: entry.workflow.identity,
    status: entry.status,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    taskKey: entry.taskKey,
    taskFingerprint: entry.taskFingerprint,
    claimContext: entry.claimContext,
    workerLease: entry.workerLease,
  });
}

export async function readRunAuthority(paths) {
  await assertManagedDirectory(paths.runDir, 'workflow run directory');
  await assertManagedDirectory(paths.runnerDir, 'workflow runner directory');
  await assertManagedRunStateFile(paths.authorityPath, 'workflow run authority');
  let content;
  try {
    content = await readFile(paths.authorityPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw new Error(`cannot read workflow run authority for ${paths.runId}: ${error.message}`);
  }
  try {
    return assertRunAuthority(JSON.parse(content), paths);
  } catch (error) {
    throw new Error(`cannot parse workflow run authority for ${paths.runId}: ${error.message}`);
  }
}

export async function readRunAuthorityWithLegacyFallback(paths) {
  const authority = await readRunAuthority(paths);
  if (authority) return authority;
  const index = await readRunsIndex(runsIndexPathsForRoot(paths.runsRoot));
  return runAuthorityFromIndexEntry(paths, index.runs[paths.runId]);
}

export async function writeRunAuthority(paths, authority, { createOnly = false } = {}) {
  if (currentRunStateLockToken(paths) === undefined) {
    throw new Error('workflow run authority must be written within the active run-state lock scope');
  }
  const validated = assertRunAuthority(authority, paths);
  await createManagedDirectory(paths.runDir, 'workflow run directory');
  await createManagedDirectory(paths.runnerDir, 'workflow runner directory');
  if (createOnly && await readRunAuthority(paths)) {
    throw new Error(`workflow run authority already exists: ${paths.runId}`);
  }
  await writeJsonAtomic(paths.authorityPath, validated);
  return validated;
}

export function mergeRunAuthorityIntoIndexEntry(entry, authority) {
  if (!authority) return entry;
  const merged = {
    ...entry,
    runId: authority.runId,
    workflow: { ...authority.workflow },
    status: authority.status,
    createdAt: authority.createdAt,
    updatedAt: authority.updatedAt,
    taskKey: authority.taskKey,
    taskFingerprint: authority.taskFingerprint,
    claimContext: authority.claimContext,
    workerLease: authority.workerLease,
  };
  return pruneUndefinedProperties(merged);
}
