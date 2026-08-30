import { createWorkflowRunnerCurrentState } from './WorkflowRunnerCommand/current-state.mjs';
import { createWorkflowRunnerInputSupport } from './WorkflowRunnerCommand/input-support.mjs';
import { createWorkflowRunnerPublicApi } from './WorkflowRunnerCommand/public-api.mjs';

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
  resumeCurrentStep,
  runNext,
  resolveStartupUserPrompt,
  startupUserPromptTarget,
  loadWorkflowRuntime,
  readWorkflowDocument,
  artifactPathBoundaryErrors,
  writePersistedRunStateUpdate,
  toHostResponse,
  renderCurrentRequestInstructions,
  assertRunnerHostResponseSchema,
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
  readPersistedRunState, ensureRunDirectories, ensureRunFiles, initialRunBaton,
  migrateLegacyWorkflowRunsRootIfNeeded,
  pathExists,
  resolveRunPaths,
  canonicalPersistedWorkflowPath,
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

  async function runnerResponseForRendered(paths, rendered, { initialized, resumed, leaseToken, includeInlineInstructions = false, followUp = false, workflowDoc, resources }) {
    workflowDoc ??= readWorkflowDocument(paths.workflowPath, 'workflow');
    const response = {
      ...toHostResponse(rendered, {
        runId: paths.runId,
        workflow: workflowDoc,
        workflowPath: paths.workflowPath,
        repositoryRoot: paths.repositoryRoot,
        runsRoot: paths.runsRoot,
        leaseToken,
        claimContext: paths.claimContext,
        includeInlineInstructions,
        resources,
      }),
      runId: paths.runId,
      initialized,
      resumed,
    };
    assertRunnerHostResponseSchema(response);
    for (const request of response.requests ?? []) {
      if (!['run_worker', 'wait_for_approval'].includes(request.action)) continue;
      const entry = (rendered.steps ?? []).find((candidate) => candidate.id === stepIdForRequest(request));
      if (!entry) throw new Error(`missing executable entry for workflow step '${stepIdForRequest(request)}'`);
      const instructions = renderCurrentRequestInstructions({
        request,
        workflow: workflowDoc,
        baton: rendered.baton,
        entry,
        currentEntries: rendered.steps ?? [],
        resources,
        requests: response.requests ?? [],
        runId: paths.runId,
        runsRoot: paths.runsRoot,
        leaseToken,
        followUp,
      });
      if (typeof instructions !== 'string' || instructions.trim().length === 0) {
        throw new Error(`missing compiled instructions for workflow step '${stepIdForRequest(request)}'`);
      }
    }
    return response;
  }

  async function responsePairForRendered(paths, rendered, {
    initialized,
    resumed,
    leaseToken,
    includeInlineInstructions = false,
    followUp = false,
    workflowDoc,
    resources,
  }) {
    const persistedResources = resourcesWithValidatingWriter(resources, paths);
    const persistedResponse = await runnerResponseForRendered(paths, rendered, {
      initialized,
      resumed,
      includeInlineInstructions: false,
      followUp,
      workflowDoc,
      resources: persistedResources,
    });
    const response = await runnerResponseForRendered(paths, rendered, {
      initialized,
      resumed,
      leaseToken,
      includeInlineInstructions,
      followUp,
      workflowDoc,
      resources,
    });
    return { persistedResponse, response };
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

  async function authorityForPaths(paths) { return readRunAuthorityWithLegacyFallback(paths); }

  async function persistNextHostResponse(paths, rendered, runState, { leaseToken, workflowDoc, resources, currentState } = {}) {
    const { persistedResponse, response } = await responsePairForRendered(paths, rendered, {
      ...runState,
      leaseToken,
      includeInlineInstructions: true,
      workflowDoc,
      resources,
    });
    await writePersistedRunStateUpdate(paths, {
      baton: persistedResponse.baton,
      currentRequests: persistedResponse.requests ?? [],
      history: { source: 'workflow-runner', baton: persistedResponse.baton, requests: persistedResponse.requests },
      writeBaton: runState.initialized,
    }, { currentState });
    return response;
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

  async function renderHostResponse(paths, baton, execute, { leaseToken, includeDiagnostics = false, includeInlineInstructions = false, followUp = false } = {}) {
    const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton });
    const renderResources = resourcesWithValidatingWriter(runtime.resources, paths, { leaseToken });
    const rendered = execute({ workflowDoc: runtime.workflow, batonDoc: runtime.baton, resources: renderResources, includeDiagnostics, followUp });
    const { persistedResponse, response } = await responsePairForRendered(paths, rendered, {
      initialized: false,
      resumed: true,
      leaseToken,
      includeInlineInstructions,
      workflowDoc: runtime.workflow,
      resources: renderResources,
      followUp,
    });
    return { runtime, resources: renderResources, rendered, persistedResponse, response };
  }

  async function renderCurrentHostResponse(paths, baton, options = {}) {
    return renderHostResponse(paths, baton, resumeCurrentStep, options);
  }

  async function renderStepEntryHostResponse(paths, baton, options = {}) {
    return renderHostResponse(paths, baton, runNext, options);
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
        await ensureRunDirectories(paths);
        await recoverDurableCommit(paths);
        const resumed = await pathExists(paths.batonPath);
        const persisted = resumed ? await readPersistedRunState(paths, { includeHistoryText: false }) : undefined;
        if (resumed) await ensureRunFiles(paths);
        const initialBaton = resumed ? undefined : initialRunBaton(paths, { userPrompt: startupUserPrompt, userPromptTarget: startupPromptTarget });
        const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: persisted?.baton ?? initialBaton });
        const renderResources = resourcesWithValidatingWriter(runtime.resources, paths, { leaseToken });
        const execute = resumed ? resumeCurrentStep : runNext;
        const rendered = execute({ workflowDoc: runtime.workflow, batonDoc: runtime.baton, resources: renderResources, includeDiagnostics });
        const response = await persistNextHostResponse(paths, rendered, { initialized: !resumed, resumed }, {
          leaseToken, workflowDoc: runtime.workflow, resources: renderResources, currentState: persisted,
        });
        await persistRenewedRunAuthority(paths, authority, {
          leaseToken,
          now,
          status: response.status,
          taskKey,
          taskFingerprint,
        });
        return response;
      } catch (error) {
        // A retained first-commit journal needs the original lease for public recovery.
        if (createdIndexEntry && !(await pathExists(paths.durableCommitPath))) await markNewRunFailed(paths);
        throw error;
      }
    });
  }

  const {
    currentResponse,
    currentRuntimeAndResponse,
    outputForCurrentState,
    requestAliases,
    stepIdForRequest,
    workflowStepIdForRequest,
  } = createWorkflowRunnerCurrentState({
    durableFileSignature,
    readWorkflowDocument,
    renderCurrentHostResponse,
    loadWorkflowRuntime,
    resumeCurrentStep,
    resourcesWithValidatingWriter,
    runnerResponseForRendered,
    recoverDurableCommit,
    readPersistedRunState,
  });

  async function resolveAuthorityBoundRunPaths({ runId, workflowPath, runsRoot }) {
    workflowPath = assertAbsoluteWorkflowPath(workflowPath);
    const defaultPaths = resolveRunPaths({ runId, runsRoot });
    const authority = await authorityForPaths(defaultPaths);
    const authorityWorkflowPath = authority?.workflow?.path;
    if (typeof authorityWorkflowPath === 'string' && authorityWorkflowPath.length > 0) {
      const compatibleAuthorityWorkflowPath = canonicalPersistedWorkflowPath(authorityWorkflowPath);
      const compatibleRequestedWorkflowPath = workflowPath && canonicalPersistedWorkflowPath(workflowPath);
      if (compatibleRequestedWorkflowPath && compatibleAuthorityWorkflowPath !== compatibleRequestedWorkflowPath) {
        throw new Error(`workflow run is already bound to a different workflow: ${runId}`);
      }
      return {
        ...resolveRunPaths({ runId, workflowPath: compatibleAuthorityWorkflowPath, runsRoot }),
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

  async function resolveContinueRunPaths({ runId, workflowPath, runsRoot }) { return resolveAuthorityBoundRunPaths({ runId, workflowPath, runsRoot }); }

  const { publicApiCall } = createWorkflowRunnerPublicApi({
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
  });

  async function next(options = {}) { return publicApiCall(() => nextInternal(options), { ...options, command: 'next' }); }

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
        const rendered = resumeCurrentStep({ workflowDoc: recoveryRuntime.workflow, batonDoc: recoveryRuntime.baton, resources: renderResources, includeDiagnostics });
        const { persistedResponse, response } = await responsePairForRendered(paths, rendered, { initialized: false, resumed: true, leaseToken, includeInlineInstructions: true, workflowDoc: recoveryRuntime.workflow, resources: renderResources });
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
          baton: persistedResponse.baton,
          currentRequests: persistedResponse.requests ?? [],
          history: {
            source: 'workflow-runner-continue',
            baton: persistedResponse.baton,
            output: historyOutput,
            requests: persistedResponse.requests,
            details: transitionHistoryDetails({ before: runtime.baton, after: persistedResponse.baton, output: historyOutput, requests: persistedResponse.requests }),
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
        const rendered = resumeCurrentStep({ workflowDoc: recoveryRuntime.workflow, batonDoc: recoveryRuntime.baton, resources: renderResources, includeDiagnostics });
        const { persistedResponse, response } = await responsePairForRendered(paths, rendered, { initialized: false, resumed: true, leaseToken, includeInlineInstructions: true, workflowDoc: recoveryRuntime.workflow, resources: renderResources });
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
          baton: persistedResponse.baton,
          currentRequests: persistedResponse.requests ?? [],
          history: {
            source: 'workflow-runner-continue',
            baton: persistedResponse.baton,
            output: historyOutput,
            requests: persistedResponse.requests,
            details: transitionHistoryDetails({ before: runtime.baton, after: persistedResponse.baton, output: historyOutput, requests: persistedResponse.requests }),
          },
        }, { currentState });
        await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
        return response;
      }
      const applied = applyWorkflowOutput({ workflowDoc: runtime.workflow, batonDoc: runtime.baton, outputValue, resources: runtime.resources });
      const renderResources = resourcesWithValidatingWriter(runtime.resources, paths, { leaseToken });
      const rendered = renderAppliedResponse({ workflowDoc: runtime.workflow, response: applied, resources: renderResources, includeDiagnostics });

      const { persistedResponse, response } = await responsePairForRendered(paths, rendered, { initialized: false, resumed: true, leaseToken, includeInlineInstructions: true, workflowDoc: runtime.workflow, resources: renderResources });
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
        currentRequests: persistedResponse.requests ?? [],
        history: {
          source: 'workflow-runner-continue',
          baton: applied.baton,
          output: historyOutput,
          requests: persistedResponse.requests,
          details: transitionHistoryDetails({ before: runtime.baton, after: applied.baton, output: historyOutput, requests: persistedResponse.requests }),
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
    const current = await readPersistedRunState(paths, { includeHistoryText: false });
    const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: current.baton });
    return {
      runId: paths.runId,
      ...projectPointerTransitions({
        workflow: runtime.workflow,
        baton: runtime.baton,
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
      const current = await readPersistedRunState(paths, { includeHistoryText: false });
      const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: current.baton });
      const resolved = resolvePointerMove({
        workflow: runtime.workflow,
        baton: runtime.baton,
        transitionId,
      });
      const { persistedResponse, response } = await renderStepEntryHostResponse(paths, resolved.baton, { leaseToken });
      await writePersistedRunStateUpdate(paths, {
        baton: persistedResponse.baton,
        currentRequests: persistedResponse.requests ?? [],
        history: {
          source: 'workflow-runner-move-pointer',
          baton: persistedResponse.baton,
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
          cursor: persistedResponse.baton.cursor,
          status: persistedResponse.baton.status,
        },
      };
    });
  }

  async function movePointer(options = {}) {
    return publicApiCall(() => movePointerInternal(options), { ...options, command: 'move-pointer', recordFailure: false });
  }

  const {
    applyWorkerBindingsForContinue,
    batonWithAcceptedOutput,
    currentRequestForStep,
    normalizeBindAgentSpecs,
    orchestratorDebugNote,
    parseOutputJson,
    sameStopReport,
    staleWorkflowCommandError,
    validateAcceptedOutputForRequest,
    validateReportedStop,
    validateStopResolutionOutput,
    writeContinuePreActionHistory,
  } = createWorkflowRunnerInputSupport({
    readJson,
    readText,
    resolve,
    requestAliases,
    stepIdForRequest,
    workflowStepIdForRequest,
    assertSafeStepId,
    validateRunnerAcceptedOutput,
    artifactPathBoundaryErrors,
    publicStopResolutionDetails,
    workerBindingKeyForStep,
    writePersistedRunStateUpdate,
    orchestratorDebugHistoryDetails,
    appendHistoryOnce,
    publicNonBlockingStopDetails,
  });

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
      const { runtime, resources, rendered, response } = await renderCurrentHostResponse(paths, current.baton, { leaseToken, followUp });
      if (response.status !== 'needs_host_actions') throw staleWorkflowCommandError(stepId, response);
      const request = currentRequestForStep(response, stepId);
      if (!request) throw staleWorkflowCommandError(stepId, response);
      if (!['run_worker', 'wait_for_approval'].includes(request.action)) throw staleWorkflowCommandError(stepId, response);
      const renderedStep = (rendered.steps ?? []).find((step) => step.id === stepIdForRequest(request));
      if (!renderedStep) throw staleWorkflowCommandError(stepId, response);
      const prompt = renderCurrentRequestInstructions({
        request,
        workflow: runtime.workflow,
        baton: rendered.baton,
        entry: renderedStep,
        currentEntries: rendered.steps ?? [],
        resources,
        requests: response.requests ?? [],
        runId: paths.runId,
        runsRoot: paths.runsRoot,
        leaseToken,
        followUp,
      });
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
