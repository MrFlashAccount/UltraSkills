/** Accepts validated host outputs while reserving call results for atomic execution. */
export function createWorkflowRunnerOutputAcceptance({
  migrateLegacyWorkflowRunsRootIfNeeded,
  assertSafeStepId,
  parseOutputJson,
  resolveRunPaths,
  assertPreLockWorkerLeaseAuthority,
  withRunStateLock,
  resolveContinueRunPaths,
  assertWorkerLeaseAuthority,
  ensureRunFiles,
  recoverDurableCommit,
  readPersistedRunState,
  currentRuntimeAndResponse,
  currentRequestForStep,
  staleWorkflowCommandError,
  resourcesWithValidatingWriter,
  stepIdForRequest,
  workflowStepIdForRequest,
  validateAcceptedOutputForRequest,
  resolve,
  batonWithAcceptedOutput,
  acceptedOutputHistoryDetails,
  writePersistedRunStateUpdate,
  persistRenewedRunAuthority,
  publicApiCall,
}) {
  async function acceptOutput({ runId, workflowPath, stepId, json, debugSummaryFile, leaseToken, now = new Date(), runsRoot } = {}, { expectedRequestAction } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    assertSafeStepId(stepId);
    const output = parseOutputJson(json);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now, allowStale: true });
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
      const authority = await assertWorkerLeaseAuthority(paths, { leaseToken, now, allowStale: true });
      await ensureRunFiles(paths);
      await recoverDurableCommit(paths);
      const current = await readPersistedRunState(paths, { includeHistoryText: false });
      const { runtime, response } = await currentRuntimeAndResponse(paths, current, { leaseToken });
      if (response.status !== 'needs_host_actions') throw staleWorkflowCommandError(stepId, response);
      const request = currentRequestForStep(response, stepId);
      if (!request) throw staleWorkflowCommandError(stepId, response);
      if (expectedRequestAction === undefined && request.action === 'call_function') {
        throw new Error(`workflow call step '${stepId}' must be executed through call-function`);
      }
      if (expectedRequestAction !== undefined && request.action !== expectedRequestAction) {
        throw staleWorkflowCommandError(stepId, response);
      }
      const validationResources = resourcesWithValidatingWriter(runtime.resources, paths, { leaseToken });
      const acceptedStepId = stepIdForRequest(request);
      const workflowStepId = workflowStepIdForRequest(request);
      const step = runtime.workflow.steps?.[workflowStepId];
      const effectiveRequestStep = Number.isInteger(request.shard?.index)
        ? { kind: 'worker', output: step?.worker?.output }
        : request.fanout?.branch_id
          ? { kind: 'worker', output: step?.branches?.[request.fanout.branch_id]?.output }
          : ['fanout', 'shard'].includes(step?.kind)
            ? { kind: 'worker', output: step.output }
            : step;
      const accepted = validateAcceptedOutputForRequest({
        workflow: runtime.workflow,
        resources: validationResources,
        request,
        output,
        runsRoot: paths.runsRoot,
      });
      const expectedDebugSummaryPath = request.action === 'run_worker'
        ? validationResources.debugSummaryPathForStep?.(acceptedStepId, effectiveRequestStep)
        : undefined;
      if (request.action === 'run_worker') {
        const actual = typeof debugSummaryFile === 'string' ? resolve(debugSummaryFile) : '';
        const expected = resolve(expectedDebugSummaryPath);
        if (!actual) throw new Error(`debug summary file is required for worker step '${acceptedStepId}'`);
        if (actual !== expected) throw new Error(`debug summary file for worker step '${acceptedStepId}' must be exactly ${expectedDebugSummaryPath}`);
      } else if (debugSummaryFile !== undefined) {
        throw new Error(`debug summary file is only accepted for run_worker requests, not '${request.action}'`);
      }
      const baton = batonWithAcceptedOutput(current.baton, acceptedStepId, accepted);
      const details = await acceptedOutputHistoryDetails({ stepId: acceptedStepId, request, output: accepted, debugSummaryPath: expectedDebugSummaryPath, leaseToken });
      await writePersistedRunStateUpdate(paths, {
        baton,
        currentRequests: response.requests ?? [],
        history: { source: 'workflow-runner-write-output', baton, output: `accepted:${acceptedStepId}`, requests: response.requests ?? [], details },
      }, { currentState: current });
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now });
      return {
        ok: true,
        runId: paths.runId,
        stepId: acceptedStepId,
        accepted: true,
      };
    });
  }

  async function writeOutput(options = {}) {
    return publicApiCall(() => acceptOutput(options), { ...options, command: 'write-output' });
  }

  return { acceptOutput, writeOutput };
}
