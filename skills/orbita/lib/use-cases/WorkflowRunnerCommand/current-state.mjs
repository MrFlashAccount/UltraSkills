/** Current durable-request and accepted-output projection for WorkflowRunnerCommand. */
import { createHash } from 'node:crypto';

export function createWorkflowRunnerCurrentState({
  durableFileSignature,
  readWorkflowDocument,
  renderCurrentHostResponse,
  loadWorkflowRuntime,
  runNext,
  resourcesWithValidatingWriter,
  runnerResponseForRendered,
  recoverDurableCommit,
  readPersistedRunState,
}) {
  function contentSignature(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
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
    const rendered = await renderCurrentHostResponse(paths, current.baton, { leaseToken });
    return rendered.persistedResponse;
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
      includeInlineInstructions: false,
      workflowDoc: runtime.workflow,
      resources: resourcesWithValidatingWriter(runtime.resources, paths),
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
  return {
    currentResponse,
    currentRuntimeAndResponse,
    outputForCurrentState,
    requestAliases,
    stepIdForRequest,
    workflowStepIdForRequest,
  };
}
