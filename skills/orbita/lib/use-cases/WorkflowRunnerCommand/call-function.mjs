/** Executes one current call request and atomically submits only its real result. */
export function createWorkflowRunnerCallFunction({
  migrateLegacyWorkflowRunsRootIfNeeded,
  assertSafeStepId,
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
  workflowStepIdForRequest,
  callFunctionDefinition,
  resolveCallArguments,
  validateCallArguments,
  outputSchemaForCallStep,
  persistRenewedRunAuthority,
  executeCallFunction,
  acceptOutput,
  publicApiCall,
}) {
  async function callFunctionInternal({ runId, workflowPath, stepId, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    assertSafeStepId(stepId);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now, allowStale: true });
    const invocation = await withRunStateLock(lockPaths, async () => {
      const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
      const authority = await assertWorkerLeaseAuthority(paths, { leaseToken, now, allowStale: true });
      await ensureRunFiles(paths);
      await recoverDurableCommit(paths);
      const current = await readPersistedRunState(paths, { includeHistoryText: false });
      const { runtime, response } = await currentRuntimeAndResponse(paths, current, { leaseToken });
      if (response.status !== 'needs_host_actions') throw staleWorkflowCommandError(stepId, response);
      const request = currentRequestForStep(response, stepId);
      if (!request || request.action !== 'call_function') throw staleWorkflowCommandError(stepId, response);
      const workflowStepId = workflowStepIdForRequest(request);
      const step = runtime.workflow.steps?.[workflowStepId];
      if (!step || step.kind !== 'call') throw staleWorkflowCommandError(stepId, response);
      const definition = callFunctionDefinition(runtime.resources.callFunctions, step.function);
      const argumentsValue = validateCallArguments(definition, resolveCallArguments(step, current.baton.state));
      const { schema } = outputSchemaForCallStep(step, runtime.resources);
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now });
      return {
        paths,
        functionName: definition.name,
        argumentsValue,
        outputSchema: schema,
        functions: runtime.resources.callFunctions,
      };
    });
    const output = await executeCallFunction({
      functionName: invocation.functionName,
      argumentsValue: invocation.argumentsValue,
      outputSchema: invocation.outputSchema,
      workflowPath: invocation.paths.workflowPath,
    }, { functions: invocation.functions });
    return acceptOutput({
      runId: invocation.paths.runId,
      workflowPath: invocation.paths.workflowPath,
      stepId,
      json: JSON.stringify(output),
      leaseToken,
      runsRoot: invocation.paths.runsRoot,
    }, { expectedRequestAction: 'call_function' });
  }

  async function callFunction(options = {}) {
    return publicApiCall(() => callFunctionInternal(options), { ...options, command: 'call-function' });
  }

  return { callFunction };
}
