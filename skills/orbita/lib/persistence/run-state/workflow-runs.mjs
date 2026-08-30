import { randomUUID } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertSafeRunId, canonicalPersistedWorkflowPath, defaultWorkflowPath, migrateLegacyWorkflowRunsRootIfNeeded, pathExists, resolveRunPaths, workflowRunsRoot } from './paths.mjs';
import { createRunIndexEntry, deleteRunIndexEntry, readRunsIndex, runsIndexPathsForRoot, upsertRunIndexEntry } from './run-index.mjs';
import { assertMatchingTokenAuthority, buildTokenLease, generateLeaseToken, occupancyForLease, renewTokenLease } from './lease-authority.mjs';
import { withRunStateLock } from './lock.mjs';
import {
  mergeRunAuthorityIntoIndexEntry,
  readRunAuthority,
  readRunAuthorityWithLegacyFallback,
  runAuthorityFromIndexEntry,
  writeRunAuthority,
} from './run-authority.mjs';
import { resolveAbsoluteWorkflowPath } from '../../workflow-path-boundary.mjs';

const AUTHORITY_READ_CONCURRENCY = 32;

async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

function publicRun(entry, { now = new Date() } = {}) {
  const workflow = {
    identity: entry.workflow?.identity,
  };
  for (const key of Object.keys(workflow)) if (workflow[key] === undefined) delete workflow[key];
  const result = {
    runId: entry.runId,
    title: entry.title,
    summary: entry.summary,
    workflow,
    status: entry.status,
    occupancy: occupancyForLease(entry.workerLease, now),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    taskKey: entry.taskKey,
    taskFingerprint: entry.taskFingerprint,
  };
  for (const key of Object.keys(result)) if (result[key] === undefined) delete result[key];
  return result;
}

function sortByUpdatedAtDesc(left, right) {
  return String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')) || left.runId.localeCompare(right.runId);
}

export async function listWorkflowRunsAtRoot({ runsRoot = workflowRunsRoot, now = new Date() } = {}) {
  await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
  const index = await readRunsIndex(runsIndexPathsForRoot(runsRoot));
  const entries = await mapWithConcurrency(Object.values(index.runs), AUTHORITY_READ_CONCURRENCY, async (entry) => {
    const paths = resolveRunPaths({ runId: entry.runId, workflowPath: entry.workflow.path, runsRoot });
    const authority = await readRunAuthority(paths) ?? runAuthorityFromIndexEntry(paths, entry);
    return mergeRunAuthorityIntoIndexEntry(entry, authority);
  });
  return entries.map((entry) => publicRun(entry, { now })).sort(sortByUpdatedAtDesc);
}

export function summarizeWorkflowRuns(runs) {
  const counts = { occupied: 0, stale: 0, unclaimed: 0 };
  for (const run of runs) counts[run.occupancy?.state] = (counts[run.occupancy?.state] ?? 0) + 1;
  const lines = [`workflow runs: ${runs.length} total, ${counts.occupied} occupied, ${counts.stale} stale, ${counts.unclaimed} unclaimed`];
  for (const run of runs) {
    const label = run.title ? ` ${run.title}` : '';
    const expires = run.occupancy?.leaseExpiresAt ? ` until ${run.occupancy.leaseExpiresAt}` : '';
    lines.push(`- ${run.runId}: ${run.status}, ${run.occupancy?.state ?? 'unclaimed'}${expires}${label}`);
  }
  return lines.join('\n');
}

function generatedRunId() {
  return assertSafeRunId(`run-${randomUUID()}`);
}

function workflowPathForCreate(workflowPath) {
  return workflowPath === undefined ? defaultWorkflowPath : resolveAbsoluteWorkflowPath(workflowPath);
}

function canonicalHarness(harness) {
  return typeof harness === 'string' ? harness.toLowerCase() : harness;
}

function indexProjectionPatch(authority) {
  return {
    workflowPath: authority.workflow.path,
    workflowIdentity: authority.workflow.identity,
    replaceWorkflowBinding: true,
    status: authority.status,
    createdAt: authority.createdAt,
    updatedAt: authority.updatedAt,
    taskKey: authority.taskKey,
    taskFingerprint: authority.taskFingerprint,
    claimContext: authority.claimContext,
    workerLease: authority.workerLease,
  };
}

function assertExistingWorkflowBinding(existing, paths, { requestedWorkflowPath } = {}) {
  const existingWorkflowPath = existing?.workflow?.path;
  if (requestedWorkflowPath === undefined || typeof existingWorkflowPath !== 'string' || existingWorkflowPath.length === 0) return;
  if (canonicalPersistedWorkflowPath(existingWorkflowPath) !== canonicalPersistedWorkflowPath(requestedWorkflowPath)) {
    throw new Error(`workflow run is already bound to a different workflow: ${paths.runId}`);
  }
}

export async function registerWorkflowRunAtRoot({ runId, title, summary, workflowPath, workflowIdentity, status = 'running', taskKey, taskFingerprint, runsRoot = workflowRunsRoot, claim = false, owner, harness, sessionId, workerId, leaseMs, now = new Date() } = {}) {
  await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
  const safeRunId = runId === undefined ? generatedRunId() : assertSafeRunId(runId);
  const paths = resolveRunPaths({ runId: safeRunId, workflowPath: workflowPathForCreate(workflowPath), runsRoot });
  const leaseToken = claim ? generateLeaseToken() : undefined;
  const workerLease = claim ? buildTokenLease({ token: leaseToken, leaseMs, now }) : null;
  return withRunStateLock(paths, async () => {
    if (await readRunAuthorityWithLegacyFallback(paths)) throw new Error(`workflow run already exists: ${paths.runId}`);
    const entry = await createRunIndexEntry(paths, {
      title,
      summary,
      workflowPath: paths.workflowPath,
      workflowIdentity,
      status,
      taskKey,
      taskFingerprint,
      ...(claim && harness !== undefined ? { claimContext: { harness: canonicalHarness(harness) } } : {}),
      workerLease,
    });
    const authority = runAuthorityFromIndexEntry(paths, entry);
    try {
      await writeRunAuthority(paths, authority, { createOnly: true });
    } catch (error) {
      await deleteRunIndexEntry(paths);
      throw error;
    }
    const response = publicRun(mergeRunAuthorityIntoIndexEntry(entry, authority), { now });
    if (leaseToken) response.leaseToken = leaseToken;
    return response;
  });
}

async function claimWorkflowRunAtRootInternal({ runId, workflowPath, runsRoot = workflowRunsRoot, owner, harness, sessionId, workerId, leaseMs, leaseToken, takeover = false, now = new Date() } = {}, { preserveClaimContext = false } = {}) {
  await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
  const safeRunId = assertSafeRunId(runId);
  const paths = resolveRunPaths({ runId: safeRunId, workflowPath: workflowPathForCreate(workflowPath), runsRoot });
  const issuedLeaseToken = leaseToken || generateLeaseToken();
  try {
    return await withRunStateLock(paths, async () => {
      let tokenWasIssued = false;
      const existing = await readRunAuthorityWithLegacyFallback(paths);
      if (!existing) throw new Error(`unknown workflow run: ${safeRunId}`);
      assertExistingWorkflowBinding(existing, paths, { requestedWorkflowPath: workflowPath });
      const occupancy = occupancyForLease(existing.workerLease, now);
      let next;
      if (leaseToken) {
        try { assertMatchingTokenAuthority(existing.workerLease, leaseToken, { runId: safeRunId }); }
        catch (error) {
          const conflict = new Error(error.message);
          conflict.code = 'WORKFLOW_RUN_OCCUPIED';
          conflict.run = publicRun(existing, { now });
          throw conflict;
        }
        next = {
          ...existing,
          updatedAt: now.toISOString(),
          workerLease: renewTokenLease(existing.workerLease, { leaseMs, now }),
        };
        if (!preserveClaimContext) {
          if (harness === undefined) delete next.claimContext;
          else next.claimContext = { harness: canonicalHarness(harness) };
        }
      } else {
        if (occupancy.state === 'occupied' && !takeover) {
          const conflict = new Error(`workflow run is occupied: ${safeRunId}`);
          conflict.code = 'WORKFLOW_RUN_OCCUPIED';
          conflict.run = publicRun(existing, { now });
          throw conflict;
        }
        if (occupancy.state === 'stale' && !takeover) {
          const stale = new Error(`workflow run lease is stale: ${safeRunId}`);
          stale.code = 'WORKFLOW_RUN_STALE';
          stale.run = publicRun(existing, { now });
          throw stale;
        }
        tokenWasIssued = true;
        next = {
          ...existing,
          updatedAt: now.toISOString(),
          workerLease: buildTokenLease({
            token: issuedLeaseToken,
            leaseMs,
            now,
            tokenEpoch: (existing.workerLease?.tokenEpoch ?? 0) + 1,
          }),
        };
        if (harness === undefined) delete next.claimContext;
        else next.claimContext = { harness: canonicalHarness(harness) };
      }
      const entry = await upsertRunIndexEntry(paths, indexProjectionPatch(next));
      try {
        await writeRunAuthority(paths, next);
      } catch (error) {
        await upsertRunIndexEntry(paths, indexProjectionPatch(existing));
        throw error;
      }
      const response = { ok: true, claimed: true, runId: safeRunId, run: publicRun(mergeRunAuthorityIntoIndexEntry(entry, next), { now }) };
      if (tokenWasIssued) response.leaseToken = issuedLeaseToken;
      return response;
    });
  } catch (error) {
    if (error?.code === 'WORKFLOW_RUN_OCCUPIED') {
      return { ok: false, claimed: false, reason: 'occupied', runId: safeRunId, run: error.run };
    }
    if (error?.code === 'WORKFLOW_RUN_STALE') {
      return { ok: false, claimed: false, reason: 'stale', runId: safeRunId, run: error.run };
    }
    throw error;
  }
}

export async function claimWorkflowRunAtRoot(options = {}) {
  return claimWorkflowRunAtRootInternal(options);
}

export async function heartbeatWorkflowRunAtRoot({ leaseToken, ...options } = {}) {
  if (!leaseToken) throw new Error('workflow run token is required');
  return claimWorkflowRunAtRootInternal({ ...options, leaseToken }, { preserveClaimContext: true });
}

export async function releaseWorkflowRunAtRoot({ runId, workflowPath, runsRoot = workflowRunsRoot, leaseToken, now = new Date() } = {}) {
  await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
  const safeRunId = assertSafeRunId(runId);
  const paths = resolveRunPaths({ runId: safeRunId, workflowPath: workflowPathForCreate(workflowPath), runsRoot });
  return withRunStateLock(paths, async () => {
    const existing = await readRunAuthorityWithLegacyFallback(paths);
    if (!existing) throw new Error(`unknown workflow run: ${safeRunId}`);
    assertExistingWorkflowBinding(existing, paths, { requestedWorkflowPath: workflowPath });
    assertMatchingTokenAuthority(existing.workerLease, leaseToken, { runId: safeRunId });
    const next = {
      ...existing,
      updatedAt: now.toISOString(),
      workerLease: null,
    };
    delete next.claimContext;
    const entry = await upsertRunIndexEntry(paths, indexProjectionPatch(next));
    try {
      await writeRunAuthority(paths, next);
    } catch (error) {
      await upsertRunIndexEntry(paths, indexProjectionPatch(existing));
      throw error;
    }
    return {
      ok: true,
      released: true,
      runId: safeRunId,
      run: publicRun(mergeRunAuthorityIntoIndexEntry(entry, next), { now }),
    };
  });
}

async function renameRunDirForDeletion(paths) {
  const tombstonePath = `${paths.runDir}.deleting-${process.pid}-${Date.now()}-${randomUUID()}`;
  try {
    await rename(paths.runDir, tombstonePath);
    return tombstonePath;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteWorkflowRunAtRoot({ runId, runsRoot = workflowRunsRoot, now = new Date() } = {}) {
  await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
  const safeRunId = assertSafeRunId(runId);
  const paths = resolveRunPaths({ runId: safeRunId, workflowPath: defaultWorkflowPath, runsRoot });
  const directoryExisted = await pathExists(paths.runDir);
  let existing = null;
  let tombstonePath = null;
  await withRunStateLock(paths, async () => {
    const index = await readRunsIndex(runsIndexPathsForRoot(runsRoot));
    existing = index.runs[safeRunId] ?? null;
    const authority = await readRunAuthority(paths) ?? runAuthorityFromIndexEntry(paths, existing);
    const canonical = mergeRunAuthorityIntoIndexEntry(existing ?? { runId: safeRunId }, authority);
    if (occupancyForLease(authority?.workerLease, now).state === 'occupied') {
      const conflict = new Error(`workflow run is occupied: ${safeRunId}`);
      conflict.code = 'WORKFLOW_RUN_OCCUPIED';
      conflict.run = publicRun(canonical, { now });
      throw conflict;
    }
    existing = await deleteRunIndexEntry(paths);
    tombstonePath = await renameRunDirForDeletion(paths);
  });
  if (tombstonePath) await rm(tombstonePath, { recursive: true, force: true });
  return {
    ok: true,
    deleted: Boolean(existing || directoryExisted),
    runId: safeRunId,
  };
}
