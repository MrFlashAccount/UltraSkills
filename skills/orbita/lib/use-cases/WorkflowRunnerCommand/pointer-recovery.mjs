/** Owns the leased public pointer-recovery read and mutation operations. */
export function createWorkflowRunnerPointerRecovery({
  migrateLegacyWorkflowRunsRootIfNeeded,
  resolveRunPaths,
  assertPreLockWorkerLeaseAuthority,
  resolveContinueRunPaths,
  assertWorkerLeaseAuthority,
  readPersistedRunState,
  loadWorkflowRuntime,
  projectPointerTransitions,
  withRunStateLock,
  recoverDurableCommit,
  resolvePointerMove,
  renderStepEntryHostResponse,
  writePersistedRunStateUpdate,
  pointerMoveHistoryDetails,
  persistRenewedRunAuthority,
  publicApiCall,
}) {
  async function listPointerTransitionsInternal({ runId, workflowPath, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now });
    const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
    await assertWorkerLeaseAuthority(paths, { leaseToken, now });
    const current = await readPersistedRunState(paths, { includeHistoryText: false });
    const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: current.baton });
    return {
      runId: paths.runId,
      ...projectPointerTransitions({ workflow: runtime.workflow, baton: runtime.baton }),
    };
  }

  async function listPointerTransitions(options = {}) {
    return publicApiCall(() => listPointerTransitionsInternal(options), { ...options, command: 'list-pointer-transitions', recordFailure: false });
  }

  async function movePointerInternal({ runId, workflowPath, transitionId, feedback, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now });
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
      const authority = await assertWorkerLeaseAuthority(paths, { leaseToken, now });
      await recoverDurableCommit(paths);
      const current = await readPersistedRunState(paths, { includeHistoryText: false });
      const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: current.baton });
      const resolved = resolvePointerMove({ workflow: runtime.workflow, baton: runtime.baton, transitionId, feedback });
      const { persistedResponse, response } = await renderStepEntryHostResponse(paths, resolved.baton, { leaseToken });
      await writePersistedRunStateUpdate(paths, {
        baton: persistedResponse.baton,
        currentRequests: persistedResponse.requests ?? [],
        history: {
          source: 'workflow-runner-move-pointer',
          baton: persistedResponse.baton,
          output: `pointer:${resolved.transition.id}`,
          details: pointerMoveHistoryDetails({
            transition: resolved.transition,
            overwrittenPointerTransitionId: resolved.overwrittenPointerTransitionId,
          }),
        },
      }, { currentState: current });
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
      return {
        ok: true,
        runId: paths.runId,
        moved: resolved.transition,
        current: { cursor: persistedResponse.baton.cursor, status: persistedResponse.baton.status },
        warnings: resolved.overwrittenPointerTransitionId
          ? [`overwrote active pointer transition '${resolved.overwrittenPointerTransitionId}'`]
          : [],
      };
    });
  }

  async function movePointer(options = {}) {
    return publicApiCall(() => movePointerInternal(options), { ...options, command: 'move-pointer', recordFailure: false });
  }

  return { listPointerTransitions, movePointer };
}
