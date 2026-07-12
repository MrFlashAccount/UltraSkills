import { createHash } from 'node:crypto';

export function createWorkflowRunnerCommand({
  readFile,
  join,
  resolve,
  applyWorkflowOutput,
  validateRunnerAcceptedOutput,
  acceptedOutputHistoryDetails,
  orchestratorDebugHistoryDetails,
  publicFailureHistoryDetails,
  transitionHistoryDetails,
  pointerMoveHistoryDetails,
  projectPointerTransitions,
  resolvePointerMove,
  renderAppliedResponse,
  runNext,
  resolveStartupUserPrompt,
  startupUserPromptTarget,
  loadWorkflowRuntime,
  readWorkflowDocument,
  artifactPathBoundaryErrors,
  writePersistedRunStateUpdate,
  toHostResponse,
  workerBindingKeyForStep,
  assertSafeStepId,
  writeOutputCommandForStep,
  reportStopCommandForStep,
  resolveStopCommandForStep,
  readText,
  assertFreshTokenAuthority,
  assertMatchingTokenAuthority,
  buildTokenLease,
  renewTokenLease,
  appendHistoryOnce,
  recoverDurableCommit,
  readPersistedRunState,
  ensureRunFiles,
  migrateLegacyWorkflowRunsRootIfNeeded,
  pathExists,
  resolveRunPaths,
  createRunIndexEntry,
  upsertRunIndexEntry,
  readRunAuthorityWithLegacyFallback,
  runAuthorityFromIndexEntry,
  writeRunAuthority,
  durableFileSignature,
  withRunStateLock,
  publicErrorMessage,
  assertAbsoluteWorkflowPath,
  validateWorkflowStartup,
  publicNonBlockingStopDetails,
  publicStopResolutionDetails,
}) {
  async function readJson(pathname, kind) {
    let content;
    try {
      content = await readFile(pathname, 'utf8');
    } catch (error) {
      const code = typeof error?.code === 'string' ? `: ${error.code}` : '';
      throw new Error(`failed to read ${kind} JSON${code}`);
    }
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`failed to parse ${kind} JSON: ${error.message}`);
    }
  }

  function contentSignature(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  async function runnerResponseForRendered(paths, rendered, { initialized, resumed, leaseToken, includeInlineInstructions = false, workflowDoc }) {
    workflowDoc ??= readWorkflowDocument(paths.workflowPath, 'workflow');
    return {
      ...toHostResponse(rendered, {
        runId: paths.runId,
        workflow: workflowDoc,
        workflowPath: paths.workflowPath,
        repositoryRoot: paths.repositoryRoot,
        runsRoot: paths.runsRoot,
        leaseToken,
        claimContext: paths.claimContext,
        includeInlineInstructions,
      }),
      runId: paths.runId,
      initialized,
      resumed,
    };
  }

  async function assertWorkerLeaseAuthority(paths, { authority = paths.runAuthority, leaseToken, now = new Date(), allowStale = false } = {}) {
    const current = authority ?? await readRunAuthorityWithLegacyFallback(paths);
    if (allowStale) assertMatchingTokenAuthority(current?.workerLease, leaseToken, { runId: paths.runId });
    else assertFreshTokenAuthority(current?.workerLease, leaseToken, { runId: paths.runId, now });
    return current;
  }

  async function assertPreLockWorkerLeaseAuthority(paths, { leaseToken, now = new Date(), allowUnclaimed = false, allowStale = false } = {}) {
    if (!leaseToken) throw new Error('workflow run token is required');
    const authority = await readRunAuthorityWithLegacyFallback(paths);
    if (!authority && allowUnclaimed) return undefined;
    if (allowStale) assertMatchingTokenAuthority(authority?.workerLease, leaseToken, { runId: paths.runId });
    else assertFreshTokenAuthority(authority?.workerLease, leaseToken, { runId: paths.runId, now });
    return authority;
  }

  async function persistRenewedRunAuthority(paths, authority, { leaseToken, now = new Date(), status, taskKey, taskFingerprint } = {}) {
    assertMatchingTokenAuthority(authority?.workerLease, leaseToken, { runId: paths.runId });
    const next = {
      ...authority,
      status: status ?? authority.status,
      updatedAt: now.toISOString(),
      workerLease: renewTokenLease(authority.workerLease, { now }),
    };
    if (taskKey !== undefined) next.taskKey = taskKey;
    if (taskFingerprint !== undefined) next.taskFingerprint = taskFingerprint;
    return writeRunAuthority(paths, next);
  }

  async function initializeMissingRunLease(paths, { leaseToken, now = new Date() } = {}) {
    const existing = paths.runAuthority ?? await readRunAuthorityWithLegacyFallback(paths);
    if (existing) return { created: false, authority: existing };
    const hasExistingRunState = await pathExists(paths.batonPath) || await pathExists(paths.historyPath);
    if (hasExistingRunState) {
      throw new Error(`workflow run requires indexed lease authority: ${paths.runId}`);
    }
    const entry = await createRunIndexEntry(paths, {
      status: 'running',
      workflowPath: paths.workflowPath,
      workerLease: buildTokenLease({ token: leaseToken, now }),
    });
    const authority = runAuthorityFromIndexEntry(paths, entry);
    try {
      await writeRunAuthority(paths, authority, { createOnly: true });
    } catch (error) {
      await upsertRunIndexEntry(paths, { status: 'failed', workflowPath: paths.workflowPath, workerLease: null });
      throw error;
    }
    return { created: true, authority };
  }

  async function markNewRunFailed(paths) {
    const current = await readRunAuthorityWithLegacyFallback(paths);
    const updatedAt = new Date().toISOString();
    const authority = current && await writeRunAuthority(paths, {
      ...current,
      status: 'failed',
      updatedAt,
      workerLease: null,
    });
    await upsertRunIndexEntry(paths, {
      status: 'failed',
      workflowPath: authority?.workflow.path ?? paths.workflowPath,
      workflowIdentity: authority?.workflow.identity,
      replaceWorkflowBinding: authority !== undefined,
      updatedAt,
      claimContext: authority?.claimContext,
      workerLease: null,
    });
  }

  async function authorityForPaths(paths) {
    return readRunAuthorityWithLegacyFallback(paths);
  }

  async function persistNextHostResponse(paths, rendered, runState, { leaseToken, workflowDoc, currentState } = {}) {
    const persistedResponse = await runnerResponseForRendered(paths, rendered, { ...runState, workflowDoc });
    await writePersistedRunStateUpdate(paths, {
      baton: persistedResponse.baton,
      currentRequests: persistedResponse.requests ?? [],
      history: { source: 'workflow-runner', baton: persistedResponse.baton, requests: persistedResponse.requests },
      writeBaton: runState.initialized,
    }, { currentState });
    return runnerResponseForRendered(paths, rendered, { ...runState, leaseToken, includeInlineInstructions: true, workflowDoc });
  }

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

  function resourcesWithValidatingWriter(resources, paths, { leaseToken } = {}) {
    const requiresWorkerDebugSummary = (step) => step?.kind === 'worker' || step?.kind === 'fanout' || step?.kind === 'shard';
    const debugSummaryPathForStep = (stepId) => {
      assertSafeStepId(stepId);
      return join(paths.runDir, stepId, 'debug-summary.md');
    };
    return {
      ...resources,
      validatingWriterCommandForStep: (stepId, step) => writeOutputCommandForStep(paths.runId, stepId, {
        runsRoot: paths.runsRoot,
        leaseToken,
        debugSummaryFile: requiresWorkerDebugSummary(step) ? debugSummaryPathForStep(stepId) : undefined,
      }),
      reportStopCommandForStep: (stepId) => reportStopCommandForStep(paths.runId, stepId, {
        runsRoot: paths.runsRoot,
        leaseToken,
      }),
      artifactOutputDirForStep: (stepId) => {
        assertSafeStepId(stepId);
        return join(paths.runDir, stepId, 'artifacts');
      },
      debugSummaryPathForStep: (stepId, step) => requiresWorkerDebugSummary(step) ? debugSummaryPathForStep(stepId) : undefined,
    };
  }

  async function renderCurrentHostResponse(paths, baton, { leaseToken, includeDiagnostics = false, includeInlineInstructions = false, followUp = false } = {}) {
    const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton });
    const renderResources = resourcesWithValidatingWriter(runtime.resources, paths, { leaseToken });
    const rendered = runNext({ workflowDoc: runtime.workflow, batonDoc: runtime.baton, resources: renderResources, includeDiagnostics, followUp });
    const response = await runnerResponseForRendered(paths, rendered, {
      initialized: false,
      resumed: true,
      leaseToken,
      includeInlineInstructions,
      workflowDoc: runtime.workflow,
    });
    return { runtime, rendered, response };
  }

  async function nextInternal({ runId, workflowPath, includeDiagnostics = false, userPrompt, userPromptFile, taskKey, taskFingerprint, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now, allowUnclaimed: true });
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveAuthorityBoundRunPaths({ runId, workflowPath, runsRoot });
      const hasExistingBaton = await pathExists(paths.batonPath);
      if (!hasExistingBaton) validateWorkflowStartup({ workflowPath: paths.workflowPath });
      const initialization = await initializeMissingRunLease(paths, { leaseToken, now });
      const createdIndexEntry = initialization.created;
      try {
        const authority = await assertWorkerLeaseAuthority(paths, { authority: initialization.authority, leaseToken, now });
        if (!hasExistingBaton && userPromptFile !== undefined && String(userPromptFile).trim().length === 0) {
          throw new Error('--user-prompt-file path must not be empty or whitespace-only');
        }
        const userPromptFileContent = (!hasExistingBaton && userPromptFile !== undefined) ? await readText(userPromptFile, '--user-prompt-file') : undefined;
        const startupUserPrompt = hasExistingBaton ? undefined : resolveStartupUserPrompt({ userPrompt, userPromptFileContent });
        const workflowDoc = startupUserPrompt === undefined ? undefined : readWorkflowDocument(paths.workflowPath, 'workflow');
        const startupPromptTarget = startupUserPrompt === undefined
          ? undefined
          : startupUserPromptTarget({ workflow: workflowDoc, start: workflowDoc?.start });
        const runState = await ensureRunFiles(paths, { userPrompt: startupUserPrompt, userPromptTarget: startupPromptTarget });
        await recoverDurableCommit(paths);
        const persisted = await readPersistedRunState(paths, { includeHistoryText: false });
        const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: persisted.baton });
        const renderResources = resourcesWithValidatingWriter(runtime.resources, paths, { leaseToken });
        const rendered = runNext({ workflowDoc: runtime.workflow, batonDoc: persisted.baton, resources: renderResources, includeDiagnostics });
        const response = await persistNextHostResponse(paths, rendered, {
          initialized: runState.initialized,
          resumed: runState.resumed,
        }, { leaseToken, workflowDoc: runtime.workflow, currentState: persisted });
        await persistRenewedRunAuthority(paths, authority, {
          leaseToken,
          now,
          status: response.status,
          taskKey,
          taskFingerprint,
        });
        return response;
      } catch (error) {
        if (createdIndexEntry) await markNewRunFailed(paths);
        throw error;
      }
    });
  }

  function requestAliases(request) {
    return [request.id, request.stepId].filter((value, index, values) => typeof value === 'string' && value.length > 0 && values.indexOf(value) === index);
  }

  function stepIdForRequest(request) {
    return request.stepId ?? request.id;
  }

  function workflowStepIdForRequest(request) {
    return request.parentStepId ?? request.ownerStepId ?? stepIdForRequest(request);
  }

  function acceptedOutputForRequest(baton, request) {
    for (const alias of requestAliases(request)) {
      if (Object.hasOwn(baton?.state ?? {}, alias)) return structuredClone(baton.state[alias]);
    }
    return undefined;
  }

  function acceptedOutputsForRequests(baton, requests) {
    const valuesByRequestId = new Map();
    const missing = [];
    for (const request of requests) {
      const value = acceptedOutputForRequest(baton, request);
      if (value === undefined) missing.push(request.id);
      else valuesByRequestId.set(request.id, value);
    }
    return { valuesByRequestId, missing };
  }

  function parsedOutputRefsForAcceptedState(baton, requests) {
    const currentAliases = new Set(requests.flatMap(requestAliases));
    return Object.keys(baton?.state ?? {})
      .filter((stepId) => currentAliases.has(stepId))
      .map((stepId) => ({ stepId }));
  }

  function assertNamedOutputRefsMatchRequests(parsedOutputRefs, requests) {
    const allowedAliases = new Set(requests.flatMap(requestAliases));
    const mismatched = parsedOutputRefs
      .map((ref) => ref.stepId)
      .filter((stepId) => typeof stepId !== 'string' || !allowedAliases.has(stepId));
    if (mismatched.length > 0) {
      throw new Error(`host output step id does not match current workflow request: ${mismatched.join(', ')}`);
    }
  }

  function outputForAcceptedState(currentBaton, requests, { hasSyntheticRequests }) {
    const parsedOutputRefs = parsedOutputRefsForAcceptedState(currentBaton, requests);
    assertNamedOutputRefsMatchRequests(parsedOutputRefs, requests);
    const { valuesByRequestId, missing } = acceptedOutputsForRequests(currentBaton, requests);
    if (missing.length > 0) {
      throw new Error(`missing accepted host output for workflow step ${missing.join(', ')}; run workflow-runner write-output first`);
    }
    if (requests.length === 1 && !hasSyntheticRequests) {
      const request = requests[0];
      return { outputValue: valuesByRequestId.get(request.id), historyOutput: `accepted:${stepIdForRequest(request)}`, currentBaton };
    }

    const steps = {};
    const historyOutput = [];
    for (const request of requests) {
      const stepId = stepIdForRequest(request);
      steps[stepId] = valuesByRequestId.get(request.id);
      historyOutput.push(`accepted:${stepId}`);
    }
    return { outputValue: { steps }, historyOutput: historyOutput.join(', '), currentBaton };
  }

  function reportedStopsForRequests(currentBaton, requests) {
    const stops = {};
    for (const request of requests) {
      const requestId = stepIdForRequest(request);
      const stop = currentBaton?.nonBlockingStops?.[requestId];
      if (stop) stops[requestId] = structuredClone(stop);
    }
    return stops;
  }

  function acceptedOutputsExcludingStops({ requests, valuesByRequestId, nonBlockingStops }) {
    const outputs = {};
    for (const request of requests) {
      const stepId = stepIdForRequest(request);
      if (Object.hasOwn(nonBlockingStops, stepId)) continue;
      outputs[stepId] = valuesByRequestId.get(request.id);
    }
    return outputs;
  }

  function resolvedStopsForRequests(currentBaton, requests) {
    const stops = {};
    for (const request of requests) {
      if (request.action !== 'resolve_non_blocking_stop') continue;
      const requestId = stepIdForRequest(request);
      const stop = currentBaton?.nonBlockingStops?.[requestId];
      if (!stop?.resolution) continue;
      stops[requestId] = structuredClone(stop);
    }
    return stops;
  }

  function withContinuationContext(value, context) {
    return { ...value, ...context };
  }

  function outputOrRecoveryForAcceptedState(currentBaton, requests, { hasSyntheticRequests, runtime, response, currentHistoryText }) {
    const context = { runtime, response, currentHistoryText };
    const parsedOutputRefs = parsedOutputRefsForAcceptedState(currentBaton, requests);
    assertNamedOutputRefsMatchRequests(parsedOutputRefs, requests);
    const { valuesByRequestId } = acceptedOutputsForRequests(currentBaton, requests);
    const recoveryResolutions = resolvedStopsForRequests(currentBaton, requests);
    if (Object.keys(recoveryResolutions).length > 0) {
      return withContinuationContext({
        recoveryResolutions,
        historyOutput: Object.keys(recoveryResolutions).map((requestId) => `resolved-stop:${requestId}`).join(', '),
        currentBaton,
      }, context);
    }

    const nonBlockingStops = reportedStopsForRequests(currentBaton, requests);
    const missing = requests
      .filter((request) => !valuesByRequestId.has(request.id) && !Object.hasOwn(nonBlockingStops, stepIdForRequest(request)))
      .map((request) => request.id);
    if (missing.length > 0) {
      throw new Error(`missing completed output or non-blocking stop for workflow request ${missing.join(', ')}; run workflow-runner write-output or report-stop first`);
    }

    if (Object.keys(nonBlockingStops).length > 0) {
      const historyOutput = requests
        .map((request) => Object.hasOwn(nonBlockingStops, stepIdForRequest(request))
          ? `stopped:${stepIdForRequest(request)}`
          : `accepted:${stepIdForRequest(request)}`)
        .join(', ');
      const acceptedOutputs = acceptedOutputsExcludingStops({
        requests,
        valuesByRequestId,
        nonBlockingStops,
      });
      return withContinuationContext({ nonBlockingStops, acceptedOutputs, historyOutput, currentBaton }, context);
    }

    return withContinuationContext(
      outputForAcceptedState(currentBaton, requests, { hasSyntheticRequests }),
      context,
    );
  }

  async function responseForPersistedCurrentRequests(paths, current) {
    if (!Array.isArray(current.currentRequests)) return undefined;
    if (typeof current.currentRequestsWorkflowSignature !== 'string') return undefined;
    if (typeof current.currentRequestsBatonSignature !== 'string') return undefined;
    const currentWorkflowSignature = await durableFileSignature(paths.workflowPath);
    if (current.currentRequestsWorkflowSignature !== currentWorkflowSignature) return undefined;
    const currentBatonSignature = /^[0-9a-f]{64}$/.test(current.currentRequestsBatonSignature)
      ? contentSignature(current.baton)
      : await durableFileSignature(paths.batonPath);
    if (current.currentRequestsBatonSignature !== currentBatonSignature) return undefined;
    const requests = structuredClone(current.currentRequests);
    return {
      status: requests.length > 0 ? 'needs_host_actions' : 'done',
      requests,
    };
  }

  async function currentResponse(paths, current, { leaseToken } = {}) {
    const persistedResponse = await responseForPersistedCurrentRequests(paths, current);
    if (persistedResponse) return persistedResponse;
    const { response } = await renderCurrentHostResponse(paths, current.baton, { leaseToken });
    return response;
  }

  async function currentRuntimeAndResponse(paths, current, { leaseToken } = {}) {
    const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: current.baton });
    const persistedResponse = await responseForPersistedCurrentRequests(paths, current);
    if (persistedResponse) return { runtime, response: persistedResponse };
    const rendered = runNext({
      workflowDoc: runtime.workflow,
      batonDoc: runtime.baton,
      resources: resourcesWithValidatingWriter(runtime.resources, paths, { leaseToken }),
    });
    const response = await runnerResponseForRendered(paths, rendered, {
      initialized: false,
      resumed: true,
      leaseToken,
      includeInlineInstructions: false,
      workflowDoc: runtime.workflow,
    });
    return { runtime, response };
  }

  async function outputForCurrentState(paths, { includeHistoryText = false } = {}) {
    await recoverDurableCommit(paths);
    const current = await readPersistedRunState(paths, { includeHistoryText });
    const { runtime, response } = await currentRuntimeAndResponse(paths, current);
    if (response.status !== 'needs_host_actions') throw new Error(`current runner response is '${response.status}', not needs_host_actions`);

    const requests = response.requests ?? [];
    const hasSyntheticRequests = requests.some((request) => stepIdForRequest(request) !== current.baton?.cursor);
    return {
      ...outputOrRecoveryForAcceptedState(current.baton, requests, {
        hasSyntheticRequests,
        runtime,
        response,
        currentHistoryText: current.history?.text,
      }),
      currentState: current,
    };
  }

  async function resolveAuthorityBoundRunPaths({ runId, workflowPath, runsRoot }) {
    workflowPath = assertAbsoluteWorkflowPath(workflowPath);
    const defaultPaths = resolveRunPaths({ runId, runsRoot });
    const authority = await authorityForPaths(defaultPaths);
    const authorityWorkflowPath = authority?.workflow?.path;
    if (typeof authorityWorkflowPath === 'string' && authorityWorkflowPath.length > 0) {
      if (workflowPath && resolve(authorityWorkflowPath) !== resolve(workflowPath)) {
        throw new Error(`workflow run is already bound to a different workflow: ${runId}`);
      }
      return {
        ...resolveRunPaths({ runId, workflowPath: authorityWorkflowPath, runsRoot }),
        claimContext: authority.claimContext,
        runAuthority: authority,
      };
    }
    return {
      ...(workflowPath ? resolveRunPaths({ runId, workflowPath, runsRoot }) : defaultPaths),
      claimContext: authority?.claimContext,
      runAuthority: authority,
    };
  }

  async function resolveContinueRunPaths({ runId, workflowPath, runsRoot }) {
    return resolveAuthorityBoundRunPaths({ runId, workflowPath, runsRoot });
  }

  async function next(options = {}) {
    return publicApiCall(() => nextInternal(options), { ...options, command: 'next' });
  }

  async function continueRunInternal({ runId, workflowPath, output, includeDiagnostics = false, bindAgents, orchestratorDebugJson, orchestratorDebugFile, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    if (output !== undefined && (!Array.isArray(output) || output.length > 0)) {
      throw new Error('workflow-runner continue no longer accepts --output; run workflow-runner write-output for each current request, then continue without --output');
    }
    const normalizedBindAgents = normalizeBindAgentSpecs(bindAgents);
    const debugNote = await orchestratorDebugNote({ orchestratorDebugJson, orchestratorDebugFile });
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now, allowStale: true });
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
      const authority = await assertWorkerLeaseAuthority(paths, { leaseToken, now, allowStale: true });
      await ensureRunFiles(paths);
      const continuation = await outputForCurrentState(paths, { includeHistoryText: debugNote !== undefined });
      const { outputValue, historyOutput, nonBlockingStops, acceptedOutputs, recoveryResolutions } = continuation;
      const preActions = applyWorkerBindingsForContinue({
        baton: continuation.currentBaton,
        runtime: continuation.runtime,
        response: continuation.response,
        bindAgents: normalizedBindAgents,
      });
      const currentBaton = preActions.baton;
      const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: currentBaton });
      if (recoveryResolutions) {
        const recoveryRuntime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: runtime.baton });
        const renderResources = resourcesWithValidatingWriter(recoveryRuntime.resources, paths, { leaseToken });
        const rendered = runNext({ workflowDoc: recoveryRuntime.workflow, batonDoc: recoveryRuntime.baton, resources: renderResources, includeDiagnostics });
        const response = await runnerResponseForRendered(paths, rendered, { initialized: false, resumed: true, leaseToken, includeInlineInstructions: true, workflowDoc: recoveryRuntime.workflow });
        const currentState = await writeContinuePreActionHistory(paths, {
          bindingHistoryEntries: preActions.entries,
          debugNote,
          baton: currentBaton,
          response: continuation.response,
          currentHistoryText: continuation.currentHistoryText,
          leaseToken,
          currentState: continuation.currentState,
        });
        await writePersistedRunStateUpdate(paths, {
          baton: response.baton,
          currentRequests: response.requests ?? [],
          history: {
            source: 'workflow-runner-continue',
            baton: response.baton,
            output: historyOutput,
            requests: response.requests,
            details: transitionHistoryDetails({ before: runtime.baton, after: response.baton, output: historyOutput, requests: response.requests }),
          },
        }, { currentState });
        await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
        return response;
      }
      if (nonBlockingStops) {
        const partial = Object.keys(acceptedOutputs).length > 0
          ? applyWorkflowOutput({
              workflowDoc: runtime.workflow,
              batonDoc: runtime.baton,
              outputValue: { steps: acceptedOutputs },
              resources: runtime.resources,
            })
          : { baton: runtime.baton };
        const recoveryBaton = partial.baton;
        const recoveryRuntime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: recoveryBaton });
        const renderResources = resourcesWithValidatingWriter(recoveryRuntime.resources, paths, { leaseToken });
        const rendered = runNext({ workflowDoc: recoveryRuntime.workflow, batonDoc: recoveryRuntime.baton, resources: renderResources, includeDiagnostics });
        const response = await runnerResponseForRendered(paths, rendered, { initialized: false, resumed: true, leaseToken, includeInlineInstructions: true, workflowDoc: recoveryRuntime.workflow });
        const currentState = await writeContinuePreActionHistory(paths, {
          bindingHistoryEntries: preActions.entries,
          debugNote,
          baton: currentBaton,
          response: continuation.response,
          currentHistoryText: continuation.currentHistoryText,
          leaseToken,
          currentState: continuation.currentState,
        });
        await writePersistedRunStateUpdate(paths, {
          baton: response.baton,
          currentRequests: response.requests ?? [],
          history: {
            source: 'workflow-runner-continue',
            baton: response.baton,
            output: historyOutput,
            requests: response.requests,
            details: transitionHistoryDetails({ before: runtime.baton, after: response.baton, output: historyOutput, requests: response.requests }),
          },
        }, { currentState });
        await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
        return response;
      }
      const applied = applyWorkflowOutput({ workflowDoc: runtime.workflow, batonDoc: runtime.baton, outputValue, resources: runtime.resources });
      const renderResources = resourcesWithValidatingWriter(runtime.resources, paths, { leaseToken });
      const rendered = renderAppliedResponse({ workflowDoc: runtime.workflow, response: applied, resources: renderResources, includeDiagnostics });

      const response = await runnerResponseForRendered(paths, rendered, { initialized: false, resumed: true, leaseToken, includeInlineInstructions: true, workflowDoc: runtime.workflow });
      const currentState = await writeContinuePreActionHistory(paths, {
        bindingHistoryEntries: preActions.entries,
        debugNote,
        baton: currentBaton,
        response: continuation.response,
        currentHistoryText: continuation.currentHistoryText,
        leaseToken,
        currentState: continuation.currentState,
      });
      await writePersistedRunStateUpdate(paths, {
        baton: applied.baton,
        currentRequests: response.requests ?? [],
        history: {
          source: 'workflow-runner-continue',
          baton: applied.baton,
          output: historyOutput,
          requests: response.requests,
          details: transitionHistoryDetails({ before: runtime.baton, after: applied.baton, output: historyOutput, requests: response.requests }),
        },
      }, { currentState });
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
      return response;
    });
  }

  async function continueRun(options = {}) {
    return publicApiCall(() => continueRunInternal(options), { ...options, command: 'continue' });
  }

  async function listPointerTransitionsInternal({ runId, workflowPath, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now });
    const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
    await assertWorkerLeaseAuthority(paths, { leaseToken, now });
    const current = await readPersistedRunState(paths);
    const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: current.baton });
    return {
      runId: paths.runId,
      ...projectPointerTransitions({
        workflow: runtime.workflow,
        baton: runtime.baton,
        historyText: current.history?.text,
      }),
    };
  }

  async function listPointerTransitions(options = {}) {
    return publicApiCall(() => listPointerTransitionsInternal(options), { ...options, command: 'list-pointer-transitions', recordFailure: false });
  }

  async function movePointerInternal({ runId, workflowPath, transitionId, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now });
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
      const authority = await assertWorkerLeaseAuthority(paths, { leaseToken, now });
      await recoverDurableCommit(paths);
      const current = await readPersistedRunState(paths);
      const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: current.baton });
      const resolved = resolvePointerMove({
        workflow: runtime.workflow,
        baton: runtime.baton,
        historyText: current.history?.text,
        transitionId,
      });
      const { response } = await renderCurrentHostResponse(paths, resolved.baton, { leaseToken });
      await writePersistedRunStateUpdate(paths, {
        baton: resolved.baton,
        currentRequests: response.requests ?? [],
        history: {
          source: 'workflow-runner-move-pointer',
          baton: resolved.baton,
          output: `pointer:${resolved.transition.id}`,
          details: pointerMoveHistoryDetails({ transition: resolved.transition }),
        },
      }, { currentState: current });
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
      return {
        ok: true,
        runId: paths.runId,
        moved: resolved.transition,
        current: {
          cursor: resolved.baton.cursor,
          status: resolved.baton.status,
        },
      };
    });
  }

  async function movePointer(options = {}) {
    return publicApiCall(() => movePointerInternal(options), { ...options, command: 'move-pointer', recordFailure: false });
  }

  function parseOutputJson(json) {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`invalid JSON for workflow output: ${error.message}`);
    }
  }

  function currentRequestForStep(response, requestedStepId) {
    const requests = response.requests ?? [];
    return requests.find((request) => requestAliases(request).includes(requestedStepId));
  }

  function currentRequestStepIds(response) {
    return (response.requests ?? [])
      .map(stepIdForRequest)
      .filter((stepId, index, values) => typeof stepId === 'string' && stepId.length > 0 && values.indexOf(stepId) === index);
  }

  function staleWorkflowCommandError(stepId, response) {
    const current = currentRequestStepIds(response);
    const currentText = current.length > 0 ? current.join(', ') : 'none';
    return new Error(`stale workflow-runner command from an older response: requested step '${stepId}' is no longer valid for the current workflow state (current request step ids: ${currentText}). Use the latest workflow-runner response/instructions.`);
  }

  function validateAcceptedOutputForRequest({ workflow, resources, request, output, runsRoot }) {
    if (!['run_worker', 'wait_for_approval'].includes(request.action)) {
      throw new Error(`workflow request '${stepIdForRequest(request)}' does not accept completed output while action is '${request.action}'`);
    }
    const requestStepId = stepIdForRequest(request);
    const workflowStepId = workflowStepIdForRequest(request);
    const workflowStep = workflow.steps?.[workflowStepId];
    const step = Number.isInteger(request.shard?.index)
      ? { kind: 'worker', output: workflowStep?.worker?.output }
      : request.fanout?.branch_id
        ? { kind: 'worker', output: workflowStep?.branches?.[request.fanout.branch_id]?.output }
        : workflowStep;
    const artifactOutputDir = typeof resources?.artifactOutputDirForStep === 'function' ? resources.artifactOutputDirForStep(requestStepId) : undefined;
    return validateRunnerAcceptedOutput({
      requestStepId,
      step,
      resources,
      requestAction: request.action,
      output,
      artifactPathErrors: artifactPathBoundaryErrors(output, artifactOutputDir),
    });
  }

  function validateStopResolutionOutput(output, { runsRoot } = {}) {
    const stopId = output?.stop_id;
    if (typeof stopId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stopId)) {
      throw new Error('non-blocking stop resolution failed schema validation: /stop_id must be a UUID v4');
    }
    const resolution = output?.resolution;
    if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
      throw new Error('non-blocking stop resolution failed schema validation: /resolution must be object');
    }
    const summary = resolution.summary;
    const decision = resolution.decision ?? resolution.answer;
    if (typeof summary !== 'string' || summary.trim().length === 0) {
      throw new Error('non-blocking stop resolution failed schema validation: /resolution/summary must be non-empty string');
    }
    if (typeof decision !== 'string' || decision.trim().length === 0) {
      throw new Error('non-blocking stop resolution failed schema validation: /resolution/decision must be non-empty string');
    }
    if ('evidence' in resolution && !Array.isArray(resolution.evidence)) {
      throw new Error('non-blocking stop resolution failed schema validation: /resolution/evidence must be array');
    }
    return { stopId, resolution: publicStopResolutionDetails(output, { runsRoot }) };
  }

  function batonWithAcceptedOutput(baton, stepId, output) {
    const nextBaton = structuredClone(baton);
    nextBaton.state = {
      ...nextBaton.state,
      [stepId]: structuredClone(output),
    };
    if (nextBaton.nonBlockingStops?.[stepId]) {
      delete nextBaton.nonBlockingStops[stepId];
      if (Object.keys(nextBaton.nonBlockingStops).length === 0) delete nextBaton.nonBlockingStops;
    }
    return nextBaton;
  }

  function assertAgentId(agentId) {
    if (
      typeof agentId !== 'string' ||
      agentId.trim().length === 0 ||
      /[\r\n\0]/.test(agentId)
    ) {
      throw new Error('workflow agent id must be a non-empty single-line string');
    }
  }

  function normalizeBindAgentSpecs(bindAgents) {
    if (bindAgents === undefined) return [];
    const specs = Array.isArray(bindAgents) ? bindAgents : [bindAgents];
    return specs.map((spec) => {
      const text = String(spec ?? '');
      const separator = text.indexOf('=');
      if (separator <= 0 || separator === text.length - 1) {
        throw new Error("continue --bind-agent must use '<step-id>=<agent-id>'");
      }
      const stepId = text.slice(0, separator);
      const agentId = text.slice(separator + 1);
      assertSafeStepId(stepId);
      assertAgentId(agentId);
      return { stepId, agentId };
    });
  }

  async function orchestratorDebugNote({ orchestratorDebugJson, orchestratorDebugFile }) {
    if (orchestratorDebugJson === undefined && orchestratorDebugFile === undefined) return undefined;
    if (orchestratorDebugJson !== undefined && orchestratorDebugFile !== undefined) {
      throw new Error('continue accepts only one orchestrator debug source');
    }
    const json = orchestratorDebugJson !== undefined
      ? orchestratorDebugJson
      : await readText(orchestratorDebugFile, '--orchestrator-debug-file');
    return parseOutputJson(json);
  }

  function batonWithWorkerBinding(baton, bindingKey, agentId) {
    const nextBaton = structuredClone(baton);
    nextBaton.workerBindings = {
      ...(nextBaton.workerBindings ?? {}),
      [bindingKey]: agentId,
    };
    return nextBaton;
  }

  function applyWorkerBindingsForContinue({ baton, runtime, response, bindAgents }) {
    let nextBaton = baton;
    const entries = [];
    for (const { stepId, agentId } of bindAgents) {
      const request = currentRequestForStep(response, stepId);
      if (!request) throw staleWorkflowCommandError(stepId, response);
      if (request.action !== 'run_worker') throw new Error(`workflow step '${stepId}' is not a run_worker request`);
      const acceptedStepId = stepIdForRequest(request);
      const workflowStepId = workflowStepIdForRequest(request);
      const bindingKey = request.parentStepId || request.ownerStepId ? acceptedStepId : workerBindingKeyForStep(workflowStepId, runtime.workflow.steps?.[workflowStepId]);
      nextBaton = batonWithWorkerBinding(nextBaton, bindingKey, agentId);
      entries.push({ acceptedStepId, baton: nextBaton, requests: response.requests ?? [] });
    }
    return { baton: nextBaton, entries };
  }

  async function writeContinuePreActionHistory(paths, { bindingHistoryEntries, debugNote, baton, response, currentHistoryText, leaseToken, currentState }) {
    let nextState = currentState;
    for (const entry of bindingHistoryEntries) {
      nextState = await writePersistedRunStateUpdate(paths, {
        baton: entry.baton,
        history: { source: 'workflow-runner-continue-bind-agent', baton: entry.baton, output: `bound-agent:${entry.acceptedStepId}`, requests: entry.requests },
      }, { currentState: nextState });
    }
    if (debugNote === undefined) return nextState;
    const details = orchestratorDebugHistoryDetails({ note: debugNote, leaseToken });
    const historyScope = latestNonOrchestratorHistoryScope(currentHistoryText);
    await appendHistoryOnce(
      paths,
      { source: 'workflow-runner-continue-orchestrator', baton, requests: response.requests ?? [], details },
      { dedupeKey: `workflow-runner-continue-orchestrator:${historyScope}:${details.join('\n')}` },
    );
    return undefined;
  }

  function latestNonOrchestratorHistoryScope(historyText) {
    if (typeof historyText !== 'string' || historyText.length === 0) return 'empty-history';
    const starts = [...historyText.matchAll(/^## /gm)].map((match) => match.index);
    for (let index = starts.length - 1; index >= 0; index -= 1) {
      const start = starts[index];
      const end = starts[index + 1] ?? historyText.length;
      const entry = historyText.slice(start, end);
      if (!entry.includes('\n- source: workflow-runner-continue-orchestrator\n')) return entry.trim();
    }
    return 'orchestrator-only-history';
  }

  function validateReportedStop(output, { stepId, runsRoot } = {}) {
    const stop = output?.non_blocking_stop;
    if (!stop || typeof stop !== 'object' || Array.isArray(stop)) {
      throw new Error('non-blocking stop failed schema validation: /non_blocking_stop must be object');
    }
    if (typeof stop.stop_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stop.stop_id)) {
      throw new Error('non-blocking stop failed schema validation: /non_blocking_stop/stop_id must be a UUID v4');
    }
    for (const field of ['summary', 'needed']) {
      if (typeof stop[field] !== 'string' || stop[field].trim().length === 0) {
        throw new Error(`non-blocking stop failed schema validation: /non_blocking_stop/${field} must be non-empty string`);
      }
    }
    if ('source_step_id' in stop && (typeof stop.source_step_id !== 'string' || stop.source_step_id.trim().length === 0)) {
      throw new Error('non-blocking stop failed schema validation: /non_blocking_stop/source_step_id must be non-empty string');
    }
    if ('evidence' in stop && (!Array.isArray(stop.evidence) || stop.evidence.some((item) => typeof item !== 'string' || item.trim().length === 0))) {
      throw new Error('non-blocking stop failed schema validation: /non_blocking_stop/evidence must be an array of non-empty strings');
    }
    if ('risk' in stop && (typeof stop.risk !== 'string' || stop.risk.trim().length === 0)) {
      throw new Error('non-blocking stop failed schema validation: /non_blocking_stop/risk must be non-empty string');
    }
    if ('resolution' in stop) {
      throw new Error('non-blocking stop report must not include resolution; only the resolve-stop control action can resolve it');
    }
    return publicNonBlockingStopDetails(stop, { stepId, runsRoot });
  }

  function stopReportWithoutResolution(stop) {
    if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return stop;
    const { resolution: _resolution, ...reported } = stop;
    return reported;
  }

  function sameStopReport(left, right) {
    return JSON.stringify(stopReportWithoutResolution(left)) === JSON.stringify(stopReportWithoutResolution(right));
  }

  async function reportStopInternal({ runId, workflowPath, stepId, json, leaseToken, now = new Date(), runsRoot } = {}) {
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
      const { response } = await currentRuntimeAndResponse(paths, current, { leaseToken });
      const request = currentRequestForStep(response, stepId);
      if (!request) throw staleWorkflowCommandError(stepId, response);
      if (!['run_worker', 'wait_for_approval'].includes(request.action)) {
        throw new Error(`workflow request '${stepId}' cannot report a non-blocking stop while action is '${request.action}'`);
      }
      const requestId = stepIdForRequest(request);
      const stop = validateReportedStop(output, { stepId: requestId, runsRoot: paths.runsRoot });
      const existing = current.baton?.nonBlockingStops?.[requestId];
      if (existing) {
        if (existing.stop_id === stop.stop_id) {
          if (!sameStopReport(existing, stop)) {
            throw new Error(`non-blocking stop '${stop.stop_id}' conflicts with its previously accepted report`);
          }
          await persistRenewedRunAuthority(paths, authority, { leaseToken, now });
          return { ok: true, runId: paths.runId, stepId: requestId, reported: true, duplicate: true };
        }
        if (!existing.resolution) {
          throw new Error(`workflow request '${requestId}' already has unresolved non-blocking stop '${existing.stop_id}'`);
        }
      }
      const baton = structuredClone(current.baton);
      baton.nonBlockingStops = { ...(baton.nonBlockingStops ?? {}), [requestId]: stop };
      await writePersistedRunStateUpdate(paths, {
        baton,
        currentRequests: response.requests ?? [],
        history: {
          source: 'workflow-runner-report-stop',
          baton,
          output: `stopped:${requestId}`,
          requests: response.requests ?? [],
          details: [`non-blocking stop id: ${stop.stop_id}`],
        },
      }, { currentState: current });
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now });
      return { ok: true, runId: paths.runId, stepId: requestId, reported: true };
    });
  }

  async function reportStop(options = {}) {
    return publicApiCall(() => reportStopInternal(options), { ...options, command: 'report-stop' });
  }

  async function resolveStopInternal({ runId, workflowPath, stepId, json, leaseToken, now = new Date(), runsRoot } = {}) {
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
      const { response } = await currentRuntimeAndResponse(paths, current, { leaseToken });
      const request = currentRequestForStep(response, stepId);
      if (!request) throw staleWorkflowCommandError(stepId, response);
      const requestId = stepIdForRequest(request);
      const existing = current.baton?.nonBlockingStops?.[requestId];
      if (!existing) throw new Error(`workflow request '${requestId}' has no reported non-blocking stop`);
      const { stopId, resolution } = validateStopResolutionOutput(output, { runsRoot: paths.runsRoot });
      if (stopId !== existing.stop_id) {
        throw new Error(`stale non-blocking stop resolution '${stopId}' does not match current stop '${existing.stop_id}'`);
      }
      if (existing.resolution) {
        if (JSON.stringify(existing.resolution) !== JSON.stringify(resolution)) {
          throw new Error(`non-blocking stop resolution '${stopId}' conflicts with its previously accepted resolution`);
        }
        await persistRenewedRunAuthority(paths, authority, { leaseToken, now });
        return { ok: true, runId: paths.runId, stepId: requestId, resolved: true, duplicate: true };
      }
      if (request.action !== 'resolve_non_blocking_stop') {
        throw new Error(`workflow request '${stepId}' does not have a non-blocking stop to resolve`);
      }
      const baton = structuredClone(current.baton);
      baton.nonBlockingStops[requestId] = { ...existing, resolution };
      await writePersistedRunStateUpdate(paths, {
        baton,
        currentRequests: response.requests ?? [],
        history: {
          source: 'workflow-runner-resolve-stop',
          baton,
          output: `resolved-stop:${requestId}`,
          requests: response.requests ?? [],
          details: [`resolved non-blocking stop id: ${existing.stop_id}`],
        },
      }, { currentState: current });
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now });
      return { ok: true, runId: paths.runId, stepId: requestId, resolved: true };
    });
  }

  async function resolveStop(options = {}) {
    return publicApiCall(() => resolveStopInternal(options), { ...options, command: 'resolve-stop' });
  }

  async function writeOutputInternal({ runId, workflowPath, stepId, json, debugSummaryFile, leaseToken, now = new Date(), runsRoot } = {}) {
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
      const durableAccepted = accepted;
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
      const baton = batonWithAcceptedOutput(current.baton, acceptedStepId, durableAccepted);
      const details = await acceptedOutputHistoryDetails({ stepId: acceptedStepId, request, output: durableAccepted, debugSummaryPath: expectedDebugSummaryPath, leaseToken });
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
    return publicApiCall(() => writeOutputInternal(options), { ...options, command: 'write-output' });
  }

  async function loadInstructionsInternal({ runId, workflowPath, stepId, followUp = false, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    assertSafeStepId(stepId);
    if (followUp !== true && followUp !== false) throw new Error('followUp must be a boolean');
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now });
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveAuthorityBoundRunPaths({ runId, workflowPath, runsRoot });
      const authority = await assertWorkerLeaseAuthority(paths, { leaseToken, now });
      await recoverDurableCommit(paths);
      const current = await readPersistedRunState(paths, { includeHistoryText: false });
      const { rendered, response } = await renderCurrentHostResponse(paths, current.baton, { leaseToken, followUp });
      if (response.status !== 'needs_host_actions') throw staleWorkflowCommandError(stepId, response);
      const request = currentRequestForStep(response, stepId);
      if (!request) throw staleWorkflowCommandError(stepId, response);
      const renderedStep = (rendered.steps ?? []).find((step) => step.id === stepIdForRequest(request));
      const prompt = renderedStep?.compiledPrompt?.prompt;
      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        throw new Error(`missing compiled instructions for workflow step '${stepIdForRequest(request)}'`);
      }
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now });
      return prompt;
    });
  }

  async function loadInstructions(options = {}) {
    return publicApiCall(() => loadInstructionsInternal(options), { ...options, command: 'instructions' });
  }

  return {
    continueRun,
    listPointerTransitions,
    loadInstructions,
    movePointer,
    next,
    reportStop,
    resolveStop,
    writeOutput,
  };
}
