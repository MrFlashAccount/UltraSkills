/** Input normalization and control-write support for WorkflowRunnerCommand. */
export function createWorkflowRunnerInputSupport({
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
}) {
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
  return {
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
  };
}
