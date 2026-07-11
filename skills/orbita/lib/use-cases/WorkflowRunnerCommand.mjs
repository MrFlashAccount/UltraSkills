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
  readText,
  assertFreshTokenAuthority,
  assertMatchingTokenAuthority,
  buildTokenLease,
  renewTokenLease,
  appendHistoryOnce,
  recoverDurableCommit,
  readOperationReceipt,
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
  isRecoverableWorkerBlockerOutput,
  publicRecoverableBlockerDetails,
  publicRecoveryResolutionDetails,
  applyOutputToBatonState,
  assertBoundedHostJsonText,
  readBoundedHostJsonFile,
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

  function canonicalJson(value) {
    if (Array.isArray(value)) return value.map(canonicalJson);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }

  function acceptedOutputSignature(value) {
    return createHash('sha256').update(JSON.stringify(canonicalJson(value))).digest('hex');
  }

  function operationFingerprint(operation, input) {
    return createHash('sha256').update(JSON.stringify(canonicalJson({ operation, input }))).digest('hex');
  }

  const REPLAY_LEASE_TOKEN_PLACEHOLDER = '<workflow-runner-replay-lease-token>';

  function replaySafeValue(value, leaseToken) {
    if (typeof value === 'string') return leaseToken ? value.split(leaseToken).join(REPLAY_LEASE_TOKEN_PLACEHOLDER) : value;
    if (Array.isArray(value)) return value.map((item) => replaySafeValue(item, leaseToken));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaySafeValue(item, leaseToken)]));
  }

  function restoreReplayValue(value, leaseToken) {
    if (typeof value === 'string') return value.split(REPLAY_LEASE_TOKEN_PLACEHOLDER).join(leaseToken);
    if (Array.isArray(value)) return value.map((item) => restoreReplayValue(item, leaseToken));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreReplayValue(item, leaseToken)]));
  }

  async function replayCompletedOperation(paths, operation, fingerprint, leaseToken) {
    const receipt = await readOperationReceipt(paths);
    if (!receipt || receipt.operation !== operation || receipt.fingerprint !== fingerprint) return undefined;
    if (receipt.postBatonSignature !== await durableFileSignature(paths.batonPath)) return undefined;
    return restoreReplayValue(receipt.result, leaseToken);
  }

  async function recoverMatchingPendingOperation(paths, current, operation, fingerprint, leaseToken) {
    if (!current.commit) return undefined;
    const replay = current.commit.replay;
    if (replay !== undefined) {
      const currentBatonSignature = await durableFileSignature(paths.batonPath);
      if (current.commit.operation !== operation || replay.fingerprint !== fingerprint || replay.preBatonSignature !== currentBatonSignature) {
        throw new Error(`cannot retry interrupted ${current.commit.operation ?? 'workflow'} operation with different input`);
      }
      await recoverDurableCommit(paths);
      const receipt = await readOperationReceipt(paths);
      if (!receipt || receipt.commitId !== current.commit.id) throw new Error('recovered workflow operation receipt is missing');
      return restoreReplayValue(receipt.result, leaseToken);
    }
    // Legacy v1 and pre-replay v2 journals remain recoverable. The caller must
    // return the recovered current projection instead of executing stale input.
    await recoverDurableCommit(paths);
    return { legacyRecovered: true, operation: current.commit.operation };
  }

  async function renewReplayedOperationAuthority(paths, authority, { operation, result, leaseToken, now }) {
    let status = result?.status;
    if (operation === 'workflow-runner-move-pointer' || status === undefined) {
      const current = await readPersistedRunState(paths, { includeHistoryText: false });
      const rendered = await renderCurrentHostResponse(paths, current.baton, { leaseToken });
      status = rendered.response.status;
    }
    await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status });
    return result;
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

  async function initializeMissingRunLease(paths, { leaseToken, harness, now = new Date() } = {}) {
    const existing = paths.runAuthority ?? await readRunAuthorityWithLegacyFallback(paths);
    if (existing) return { created: false, authority: existing };
    const hasExistingRunState = await pathExists(paths.batonPath) || await pathExists(paths.historyPath);
    if (hasExistingRunState) {
      throw new Error(`workflow run requires indexed lease authority: ${paths.runId}`);
    }
    const entry = await createRunIndexEntry(paths, {
      status: 'running',
      workflowPath: paths.workflowPath,
      ...(harness !== undefined ? { claimContext: { harness: String(harness).toLowerCase() } } : {}),
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

  async function nextInternal({ runId, workflowPath, includeDiagnostics = false, userPrompt, userPromptFile, taskKey, taskFingerprint, owner, harness, sessionId, workerId, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    const existingAuthority = await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now, allowUnclaimed: true });
    if (!existingAuthority && (owner !== undefined || sessionId !== undefined || workerId !== undefined)) {
      throw new Error('workflow-runner next supports implicit claim metadata only through harness; claim first to use owner/session/worker metadata');
    }
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveAuthorityBoundRunPaths({ runId, workflowPath, runsRoot });
      const hasExistingBaton = await pathExists(paths.batonPath);
      if (!hasExistingBaton) validateWorkflowStartup({ workflowPath: paths.workflowPath });
      const initialization = await initializeMissingRunLease(paths, { leaseToken, harness, now });
      const createdIndexEntry = initialization.created;
      try {
        const authority = await assertWorkerLeaseAuthority(paths, { authority: initialization.authority, leaseToken, now });
        paths.claimContext = authority.claimContext;
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

  function isSyntheticChildRequest(request) {
    return [request.parentStepId, request.ownerStepId].some((value) => typeof value === 'string' && value.length > 0);
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

  function recoverableWorkerBlockersForAcceptedState({ workflow, requests, valuesByRequestId, runsRoot }) {
    const blockers = {};
    for (const request of requests) {
      if (isSyntheticChildRequest(request)) continue;
      const stepId = workflowStepIdForRequest(request);
      const step = workflow.steps?.[stepId];
      const output = valuesByRequestId.get(request.id);
      if (isRecoverableWorkerBlockerOutput({ workflow, stepId, step, output })) {
        blockers[stepId] = publicRecoverableBlockerDetails(output.blocker, { stepId, runsRoot });
      }
    }
    return blockers;
  }

  function acceptedOutputsExcludingRecoverableBlockers({ requests, valuesByRequestId, recoverableWorkerBlockers }) {
    const outputs = {};
    for (const request of requests) {
      const stepId = stepIdForRequest(request);
      if (Object.hasOwn(recoverableWorkerBlockers, stepId)) continue;
      outputs[stepId] = valuesByRequestId.get(request.id);
    }
    return outputs;
  }

  function recoveryResolutionsForAcceptedState({ currentBaton, requests, valuesByRequestId, runsRoot }) {
    const resolutions = {};
    for (const request of requests) {
      if (request.action !== 'resolve_worker_blocker') continue;
      const stepId = stepIdForRequest(request);
      if (!currentBaton?.recoverableWorkerBlockers?.[stepId]) continue;
      resolutions[stepId] = publicRecoveryResolutionDetails(valuesByRequestId.get(request.id), { runsRoot });
    }
    return resolutions;
  }

  function withContinuationContext(value, context) {
    return { ...value, ...context };
  }

  function outputOrRecoveryForAcceptedState(currentBaton, requests, { hasSyntheticRequests, workflow, runsRoot, runtime, response, currentHistoryText }) {
    const context = { runtime, response, currentHistoryText };
    const parsedOutputRefs = parsedOutputRefsForAcceptedState(currentBaton, requests);
    assertNamedOutputRefsMatchRequests(parsedOutputRefs, requests);
    const { valuesByRequestId, missing } = acceptedOutputsForRequests(currentBaton, requests);
    if (missing.length > 0) {
      throw new Error(`missing accepted host output for workflow step ${missing.join(', ')}; run workflow-runner write-output first`);
    }

    const recoveryResolutions = recoveryResolutionsForAcceptedState({
      currentBaton,
      requests,
      valuesByRequestId,
      runsRoot,
    });
    if (Object.keys(recoveryResolutions).length > 0) {
      const historyOutput = requests
        .map((request) => `accepted:${stepIdForRequest(request)}`)
        .join(', ');
      return withContinuationContext({ recoveryResolutions, historyOutput, currentBaton }, context);
    }

    const recoverableWorkerBlockers = recoverableWorkerBlockersForAcceptedState({
      workflow,
      requests,
      valuesByRequestId,
      runsRoot,
    });
    if (Object.keys(recoverableWorkerBlockers).length > 0) {
      const historyOutput = requests
        .map((request) => `accepted:${stepIdForRequest(request)}`)
        .join(', ');
      const acceptedOutputs = acceptedOutputsExcludingRecoverableBlockers({
        requests,
        valuesByRequestId,
        recoverableWorkerBlockers,
      });
      return withContinuationContext({ recoverableWorkerBlockers, acceptedOutputs, historyOutput, currentBaton }, context);
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
        workflow: runtime.workflow,
        runsRoot: paths.runsRoot,
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

  function cursorForRecoverableWorkerBlockers(recoverableWorkerBlockers) {
    const stepIds = Object.keys(recoverableWorkerBlockers);
    if (stepIds.length !== 1) throw new Error('recoverable worker blocker state must have exactly one owner workflow step');
    return stepIds[0];
  }

  function batonWithRecoverableWorkerBlockers(baton, recoverableWorkerBlockers, acceptedOutputs = {}) {
    const nextBaton = structuredClone(baton);
    nextBaton.state = { ...(nextBaton.state ?? {}) };
    for (const [stepId, output] of Object.entries(acceptedOutputs)) {
      nextBaton.state = applyOutputToBatonState(nextBaton, output, undefined, stepId);
    }
    for (const stepId of Object.keys(recoverableWorkerBlockers)) {
      delete nextBaton.state[stepId];
    }
    nextBaton.cursor = cursorForRecoverableWorkerBlockers(recoverableWorkerBlockers);
    nextBaton.status = 'running';
    nextBaton.recoverableWorkerBlockers = {
      ...(nextBaton.recoverableWorkerBlockers ?? {}),
      ...structuredClone(recoverableWorkerBlockers),
    };
    delete nextBaton.blocker;
    return nextBaton;
  }

  function batonWithRecoveryResolutions(baton, recoveryResolutions) {
    const nextBaton = structuredClone(baton);
    nextBaton.state = { ...(nextBaton.state ?? {}) };
    nextBaton.recoverableWorkerBlockers = {
      ...(nextBaton.recoverableWorkerBlockers ?? {}),
    };
    for (const [stepId, resolution] of Object.entries(recoveryResolutions)) {
      if (!nextBaton.recoverableWorkerBlockers[stepId]) continue;
      nextBaton.recoverableWorkerBlockers[stepId] = {
        ...nextBaton.recoverableWorkerBlockers[stepId],
        resolution: structuredClone(resolution),
      };
      delete nextBaton.state[stepId];
    }
    nextBaton.cursor = cursorForRecoverableWorkerBlockers(recoveryResolutions);
    nextBaton.status = 'running';
    delete nextBaton.blocker;
    return nextBaton;
  }

  async function continueRunInternal({ runId, workflowPath, output, includeDiagnostics = false, bindAgents, orchestratorDebugJson, orchestratorDebugFile, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    if (output !== undefined && (!Array.isArray(output) || output.length > 0)) {
      throw new Error('workflow-runner continue no longer accepts --output; run workflow-runner write-output for each current request, then continue without --output');
    }
    const normalizedBindAgents = normalizeBindAgentSpecs(bindAgents);
    const debugNote = await orchestratorDebugNote({ orchestratorDebugJson, orchestratorDebugFile });
    const replayFingerprint = operationFingerprint('workflow-runner-continue', {
      bindAgents: normalizedBindAgents,
      debugNote,
      includeDiagnostics,
      output: output ?? [],
    });
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now, allowStale: true });
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
      const authority = await assertWorkerLeaseAuthority(paths, { leaseToken, now, allowStale: true });
      await ensureRunFiles(paths);
      const beforeRecovery = await readPersistedRunState(paths, { includeHistoryText: false });
      const pendingReplay = await recoverMatchingPendingOperation(paths, beforeRecovery, 'workflow-runner-continue', replayFingerprint, leaseToken);
      if (pendingReplay !== undefined) {
        if (!pendingReplay.legacyRecovered) {
          return renewReplayedOperationAuthority(paths, authority, {
            operation: 'workflow-runner-continue',
            result: pendingReplay,
            leaseToken,
            now,
          });
        }
        if (pendingReplay.operation === undefined || pendingReplay.operation === 'workflow-runner-continue') {
          const recovered = await readPersistedRunState(paths, { includeHistoryText: false });
          const { response } = await renderCurrentHostResponse(paths, recovered.baton, {
            leaseToken,
            includeDiagnostics,
            includeInlineInstructions: true,
          });
          await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
          return response;
        }
      }
      const completedReplay = await replayCompletedOperation(paths, 'workflow-runner-continue', replayFingerprint, leaseToken);
      if (completedReplay !== undefined) {
        return renewReplayedOperationAuthority(paths, authority, {
          operation: 'workflow-runner-continue',
          result: completedReplay,
          leaseToken,
          now,
        });
      }
      const continuation = await outputForCurrentState(paths, { includeHistoryText: debugNote !== undefined });
      const { outputValue, historyOutput, recoverableWorkerBlockers, acceptedOutputs, recoveryResolutions } = continuation;
      const preActions = applyWorkerBindingsForContinue({
        baton: continuation.currentBaton,
        runtime: continuation.runtime,
        response: continuation.response,
        bindAgents: normalizedBindAgents,
      });
      const currentBaton = batonWithoutAcceptedOutputSignatures(preActions.baton, continuation.response.requests ?? []);
      const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: currentBaton });
      if (recoveryResolutions) {
        const recoveryBaton = batonWithRecoveryResolutions(runtime.baton, recoveryResolutions);
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
          replay: {
            fingerprint: replayFingerprint,
            preBatonSignature: await durableFileSignature(paths.batonPath),
            result: replaySafeValue(response, leaseToken),
          },
        }, { currentState });
        await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
        return response;
      }
      if (recoverableWorkerBlockers) {
        const recoveryBaton = batonWithRecoverableWorkerBlockers(runtime.baton, recoverableWorkerBlockers, acceptedOutputs);
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
          replay: {
            fingerprint: replayFingerprint,
            preBatonSignature: await durableFileSignature(paths.batonPath),
            result: replaySafeValue(response, leaseToken),
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
        replay: {
          fingerprint: replayFingerprint,
          preBatonSignature: await durableFileSignature(paths.batonPath),
          result: replaySafeValue(response, leaseToken),
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
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
      await assertWorkerLeaseAuthority(paths, { leaseToken, now });
      if (await pathExists(paths.durableCommitPath)) {
        throw new Error('cannot list pointer transitions while a durable workflow transaction is pending; retry the interrupted command first');
      }
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
    });
  }

  async function listPointerTransitions(options = {}) {
    return publicApiCall(() => listPointerTransitionsInternal(options), { ...options, command: 'list-pointer-transitions', recordFailure: false });
  }

  async function movePointerInternal({ runId, workflowPath, transitionId, acknowledgeRetainedState = false, leaseToken, now = new Date(), runsRoot } = {}) {
    await migrateLegacyWorkflowRunsRootIfNeeded(runsRoot);
    const lockPaths = resolveRunPaths({ runId, runsRoot });
    await assertPreLockWorkerLeaseAuthority(lockPaths, { leaseToken, now, allowStale: true });
    const replayFingerprint = operationFingerprint('workflow-runner-move-pointer', { transitionId, acknowledgeRetainedState });
    return withRunStateLock(lockPaths, async () => {
      const paths = await resolveContinueRunPaths({ runId, workflowPath, runsRoot });
      const authority = await assertWorkerLeaseAuthority(paths, { leaseToken, now, allowStale: true });
      let current = await readPersistedRunState(paths);
      const pendingReplay = await recoverMatchingPendingOperation(paths, current, 'workflow-runner-move-pointer', replayFingerprint, leaseToken);
      if (pendingReplay !== undefined) {
        if (!pendingReplay.legacyRecovered) {
          return renewReplayedOperationAuthority(paths, authority, {
            operation: 'workflow-runner-move-pointer',
            result: pendingReplay,
            leaseToken,
            now,
          });
        }
        current = await readPersistedRunState(paths);
      }
      const completedReplay = await replayCompletedOperation(paths, 'workflow-runner-move-pointer', replayFingerprint, leaseToken);
      if (completedReplay !== undefined) {
        return renewReplayedOperationAuthority(paths, authority, {
          operation: 'workflow-runner-move-pointer',
          result: completedReplay,
          leaseToken,
          now,
        });
      }
      const runtime = loadWorkflowRuntime({ workflowPath: paths.workflowPath, batonPath: paths.batonPath, baton: current.baton });
      const resolved = resolvePointerMove({
        workflow: runtime.workflow,
        baton: runtime.baton,
        historyText: current.history?.text,
        transitionId,
        acknowledgeRetainedState,
      });
      const { response } = await renderCurrentHostResponse(paths, resolved.baton, { leaseToken });
      const result = {
        ok: true,
        runId: paths.runId,
        moved: resolved.transition,
        current: {
          cursor: response.baton.cursor,
          status: response.baton.status,
        },
      };
      await writePersistedRunStateUpdate(paths, {
        baton: response.baton,
        currentRequests: response.requests ?? [],
        history: {
          source: 'workflow-runner-move-pointer',
          baton: response.baton,
          output: `pointer:${resolved.transition.id}`,
          details: pointerMoveHistoryDetails({ transition: resolved.transition }),
        },
        replay: {
          fingerprint: replayFingerprint,
          preBatonSignature: await durableFileSignature(paths.batonPath),
          result: replaySafeValue(result, leaseToken),
        },
      }, { currentState: current });
      await persistRenewedRunAuthority(paths, authority, { leaseToken, now, status: response.status });
      return result;
    });
  }

  async function movePointer(options = {}) {
    return publicApiCall(() => movePointerInternal(options), { ...options, command: 'move-pointer', recordFailure: false });
  }

  function parseOutputJson(json, { label = 'workflow output JSON' } = {}) {
    const bounded = assertBoundedHostJsonText(json, { label });
    try {
      return JSON.parse(bounded);
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
    if (request.action === 'resolve_worker_blocker') return validateRecoveryResolutionOutput(output, { runsRoot });
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
      artifactPathErrors: artifactPathBoundaryErrors(output, artifactOutputDir, resources?.runDir),
    });
  }

  function validateRecoveryResolutionOutput(output, { runsRoot } = {}) {
    const resolution = output?.resolution;
    if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
      throw new Error('blocker resolution output failed schema validation: /resolution must be object');
    }
    const summary = resolution.summary;
    const decision = resolution.decision ?? resolution.answer;
    if (typeof summary !== 'string' || summary.trim().length === 0) {
      throw new Error('blocker resolution output failed schema validation: /resolution/summary must be non-empty string');
    }
    if (typeof decision !== 'string' || decision.trim().length === 0) {
      throw new Error('blocker resolution output failed schema validation: /resolution/decision must be non-empty string');
    }
    if ('evidence' in resolution && !Array.isArray(resolution.evidence)) {
      throw new Error('blocker resolution output failed schema validation: /resolution/evidence must be array');
    }
    return { resolution: publicRecoveryResolutionDetails(output, { runsRoot }) };
  }

  function durableAcceptedOutput({ workflow, request, step, output, runsRoot }) {
    if (request.fanout?.branch_id) return output;
    const stepId = workflowStepIdForRequest(request);
    const recoverableStep = Number.isInteger(request.shard?.index) ? { kind: 'worker' } : step;
    const blockerStepId = Number.isInteger(request.shard?.index) ? stepIdForRequest(request) : stepId;
    if (isRecoverableWorkerBlockerOutput({ workflow, stepId: blockerStepId, step: recoverableStep, output })) {
      const blocker = publicRecoverableBlockerDetails(output.blocker, { stepId: blockerStepId, runsRoot });
      if (step?.kind === 'approval') return { approval: 'blocked', blocker };
      return { outcome: 'blocked', blocker };
    }
    return output;
  }

  function batonWithAcceptedOutput(baton, stepId, output, { clearRecoverableBlocker = true } = {}) {
    const nextBaton = structuredClone(baton);
    nextBaton.state = {
      ...nextBaton.state,
      [stepId]: structuredClone(output),
    };
    if (clearRecoverableBlocker && nextBaton.recoverableWorkerBlockers?.[stepId]) {
      delete nextBaton.recoverableWorkerBlockers[stepId];
      if (Object.keys(nextBaton.recoverableWorkerBlockers).length === 0) delete nextBaton.recoverableWorkerBlockers;
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
    const normalized = specs.map((spec) => {
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
    return normalized.filter((binding, index) => normalized.findIndex((candidate) => candidate.stepId === binding.stepId && candidate.agentId === binding.agentId) === index);
  }

  async function orchestratorDebugNote({ orchestratorDebugJson, orchestratorDebugFile }) {
    if (orchestratorDebugJson === undefined && orchestratorDebugFile === undefined) return undefined;
    if (orchestratorDebugJson !== undefined && orchestratorDebugFile !== undefined) {
      throw new Error('continue accepts only one orchestrator debug source');
    }
    const json = orchestratorDebugJson !== undefined
      ? orchestratorDebugJson
      : await readBoundedHostJsonFile(orchestratorDebugFile);
    return parseOutputJson(json, { label: 'orchestrator debug JSON' });
  }

  function batonWithWorkerBinding(baton, bindingKey, agentId) {
    const nextBaton = structuredClone(baton);
    nextBaton.workerBindings = {
      ...(nextBaton.workerBindings ?? {}),
      [bindingKey]: agentId,
    };
    return nextBaton;
  }

  function workerBindingKeyForRequest(runtime, request) {
    const acceptedStepId = stepIdForRequest(request);
    const workflowStepId = workflowStepIdForRequest(request);
    const workflowStep = runtime.workflow.steps?.[workflowStepId];
    if (Number.isInteger(request.shard?.index)) return acceptedStepId;
    const executableStep = request.fanout?.branch_id
      ? workflowStep?.branches?.[request.fanout.branch_id]
      : workflowStep;
    return workerBindingKeyForStep(acceptedStepId, executableStep);
  }

  function applyWorkerBindingsForContinue({ baton, runtime, response, bindAgents }) {
    let nextBaton = baton;
    const entries = [];
    const bindings = bindAgents.map(({ stepId, agentId }) => {
      const request = currentRequestForStep(response, stepId);
      if (!request) throw staleWorkflowCommandError(stepId, response);
      if (request.action !== 'run_worker') throw new Error(`workflow step '${stepId}' is not a run_worker request`);
      const acceptedStepId = stepIdForRequest(request);
      const bindingKey = workerBindingKeyForRequest(runtime, request);
      return { acceptedStepId, bindingKey, agentId };
    });
    const requestedByBindingKey = new Map();
    for (const { bindingKey, agentId } of bindings) {
      const previous = requestedByBindingKey.get(bindingKey);
      if (previous !== undefined && previous !== agentId) {
        throw new Error(`continue --bind-agent assigns conflicting worker ids to logical agent '${bindingKey}'`);
      }
      requestedByBindingKey.set(bindingKey, agentId);
    }
    for (const { acceptedStepId, bindingKey, agentId } of bindings) {
      if (nextBaton.workerBindings?.[bindingKey] === agentId) continue;
      nextBaton = batonWithWorkerBinding(nextBaton, bindingKey, agentId);
      entries.push({ acceptedStepId, baton: nextBaton, requests: response.requests ?? [] });
    }
    return { baton: nextBaton, entries };
  }

  function batonWithoutAcceptedOutputSignatures(baton, requests) {
    if (!baton.acceptedHostOutputSignatures) return baton;
    const nextBaton = structuredClone(baton);
    for (const request of requests) delete nextBaton.acceptedHostOutputSignatures[stepIdForRequest(request)];
    if (Object.keys(nextBaton.acceptedHostOutputSignatures).length === 0) delete nextBaton.acceptedHostOutputSignatures;
    return nextBaton;
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
      const durableAccepted = durableAcceptedOutput({
        workflow: runtime.workflow,
        request,
        step,
        output: accepted,
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
      const signature = acceptedOutputSignature(durableAccepted);
      const existingSignature = current.baton.acceptedHostOutputSignatures?.[acceptedStepId];
      if (existingSignature !== undefined) {
        if (existingSignature !== signature) {
          throw new Error(`workflow output for step '${acceptedStepId}' was already accepted with a different payload`);
        }
        await persistRenewedRunAuthority(paths, authority, { leaseToken, now });
        return {
          ok: true,
          runId: paths.runId,
          stepId: acceptedStepId,
          accepted: true,
          idempotent: true,
        };
      }
      const baton = batonWithAcceptedOutput(current.baton, acceptedStepId, durableAccepted, {
        clearRecoverableBlocker: request.action !== 'resolve_worker_blocker',
      });
      baton.acceptedHostOutputSignatures = {
        ...(baton.acceptedHostOutputSignatures ?? {}),
        [acceptedStepId]: signature,
      };
      const details = await acceptedOutputHistoryDetails({ stepId: acceptedStepId, request, output: durableAccepted, debugSummaryPath: expectedDebugSummaryPath, runDir: paths.runDir, leaseToken });
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
    writeOutput,
  };
}
