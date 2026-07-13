/** Public error projection and bounded failure-history recording. */
export function createWorkflowRunnerPublicApi({
  publicErrorMessage,
  resolveRunPaths,
  assertPreLockWorkerLeaseAuthority,
  withRunStateLock,
  resolveAuthorityBoundRunPaths,
  assertWorkerLeaseAuthority,
  pathExists,
  recoverDurableCommit,
  readPersistedRunState,
  publicFailureHistoryDetails,
  appendHistoryOnce,
}) {
  function publicApiError(error, options = {}) {
    const redacted = new Error(publicErrorMessage(error?.message ?? error, options));
    if (error?.code) redacted.code = error.code;
    return redacted;
  }

  async function recordPublicRunnerFailure(error, options = {}) {
    const { runId, workflowPath, runsRoot, leaseToken, command, now = new Date() } = options;
    if (!runId || !leaseToken) return false;
    try {
      const lockPaths = resolveRunPaths({ runId, runsRoot });
      await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now, allowStale: true });
      return await withRunStateLock(lockPaths, async () => {
        const paths = await resolveAuthorityBoundRunPaths({ runId, workflowPath, runsRoot });
        await assertWorkerLeaseAuthority(paths, { leaseToken, now, allowStale: true });
        if (!(await pathExists(paths.historyPath)) || !(await pathExists(paths.batonPath))) return false;
        if (await pathExists(paths.durableCommitPath)) return false;
        await recoverDurableCommit(paths);
        const current = await readPersistedRunState(paths, { includeHistoryText: false });
        const details = publicFailureHistoryDetails({
          command,
          error: publicErrorMessage(error?.message ?? error, { runsRoot: paths.runsRoot }),
          leaseToken,
        });
        return await appendHistoryOnce(
          paths,
          { source: 'workflow-runner-failure', baton: current.baton, details },
          { dedupeKey: `workflow-runner-failure:${command}:${details.join('\n')}` },
        );
      });
    } catch {
      return false;
    }
  }

  async function publicApiCall(callback, options = {}) {
    try { return await callback(); }
    catch (error) {
      if (options.recordFailure !== false) await recordPublicRunnerFailure(error, options);
      throw publicApiError(error, options);
    }
  }
  return { publicApiCall };
}
