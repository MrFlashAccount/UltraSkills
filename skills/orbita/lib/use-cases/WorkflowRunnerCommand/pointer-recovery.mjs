/** Owns the leased public pointer-recovery read and mutation operations. */
export function createWorkflowRunnerPointerRecovery({
  applyWorkflowOutput,
  outputForCurrentState,
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
  renderCurrentHostResponse,
  assertPointerMoveTargetPreflight,
  writePersistedRunStateUpdate,
  pointerMoveHistoryDetails,
  persistRenewedRunAuthority,
  publicApiCall,
}) {
  function hasAcceptedCurrentFanoutBatch(baton) {
    const activation = baton?.state?.fanouts?.[baton.cursor];
    return activation?.phase === 'branches'
      && Array.isArray(activation.current_requests)
      && activation.current_requests.length > 0
      && activation.current_requests.every((requestId) => Object.hasOwn(baton.state ?? {}, requestId));
  }

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
      let renderBaton = resolved.baton;
      if (resolved.transition.direction === 'resume' && hasAcceptedCurrentFanoutBatch(renderBaton)) {
        const continuation = await outputForCurrentState(paths);
        const applied = applyWorkflowOutput({
          workflowDoc: runtime.workflow,
          batonDoc: renderBaton,
          outputValue: continuation.outputValue,
          resources: runtime.resources,
        });
        renderBaton = applied.baton;
      }
      const renderTarget = resolved.transition.direction === 'resume'
        ? renderCurrentHostResponse
        : renderStepEntryHostResponse;
      const { persistedResponse, response } = await renderTarget(paths, renderBaton, { leaseToken });
      assertPointerMoveTargetPreflight({
        workflow: runtime.workflow,
        baton: persistedResponse.baton,
        resources: runtime.resources,
        transition: resolved.transition,
      });
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
