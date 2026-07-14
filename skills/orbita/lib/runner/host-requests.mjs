/** Public host-request projection from neutral executable runtime entries. */
import {
  assertSafeStepId,
  continueInstructionCommandForRun,
  loadFollowupInstructionsCommandForStep,
  loadInstructionsCommandForStep,
  resolveStopCommandForStep,
  writeOutputCommandForStep,
} from './runner-command-builder.mjs';
import { publicNonBlockingStopDetails } from '../runtime/non-blocking-stop.mjs';
import { projectHostActions, RESOLVE_NON_BLOCKING_STOP_ACTION } from '../runtime/host-action-plan.mjs';
import { renderApprovalInstructions } from '../runtime/approval-contract.mjs';
import { assertRunnerHostResponseSchema } from '../persistence/run-state/schema/runner-host-response-schema.mjs';

const TERMINAL_ACTIONS = new Set(['stop_done']);
const SUPERSEDES_STDOUT_INSTRUCTION = 'Supersedes all previous workflow-runner stdout.';

export { assertSafeStepId, RESOLVE_NON_BLOCKING_STOP_ACTION };

export function responseStatusForInterpreterResponse(interpreterResponse) {
  const steps = interpreterResponse.steps ?? [];
  if (steps.length === 1 && steps[0].action === 'stop_done') return 'done';
  return 'needs_host_actions';
}

function requestInstructionBlock(request) {
  const lines = [`- ${request.action}: ${request.id}`];
  if (request.parentStepId) lines.push(`  parent step: ${request.parentStepId}`);
  if (request.ownerStepId) lines.push(`  owner step: ${request.ownerStepId}`);

  if (request.action === 'run_worker') {
    if (request.agentRuntime) lines.push(`  For a fresh subagent, use model ${request.agentRuntime.model} with thinking level ${request.agentRuntime.thinkingLevel}.`);
    if (request.preferredAgentId) lines.push(`  preferred worker id: ${request.preferredAgentId}`);
    lines.push(`  fresh-worker instruction-loader command: ${request.loadInstructionsCommand}`);
    lines.push('  send that command to the worker bootstrap; do not run it in the orchestrator');
    if (request.loadFollowupInstructionsCommand) {
      lines.push(`  preferred-worker follow-up instruction-loader command: ${request.loadFollowupInstructionsCommand}`);
      lines.push('  send that command only when restoring the preferred worker; do not run it in the orchestrator');
    }
    lines.push(`  pass actual worker id to continue: --bind-agent '${request.stepId}=<agent-id>'`);
    if (request.nonBlockingStop) lines.push(`  non-blocking stop: ${JSON.stringify(request.nonBlockingStop)}`);
    if (request.shard) lines.push(`  shard: ${JSON.stringify(request.shard)}`);
    if (request.fanout) lines.push(`  fanout: ${JSON.stringify(request.fanout)}`);
    return lines.join('\n');
  }

  if (request.action === 'wait_for_approval') {
    lines.push(`  current approval instruction-loader command: ${request.loadInstructionsCommand}`);
    lines.push('  execute the dedicated approval projection in this stdout; do not send it to a worker');
    return lines.join('\n');
  }

  if (request.action === RESOLVE_NON_BLOCKING_STOP_ACTION) {
    lines.push(`  non-blocking stop: ${JSON.stringify(request.nonBlockingStop)}`);
    lines.push(`  write resolution: ${request.resolveStopCommand}`);
    return lines.join('\n');
  }

  return lines.join('\n');
}

function hostRequestInstructionList(requests = []) {
  if (requests.length === 0) return 'Current host requests: none.';
  return [
    'Execute every current host request below and wait until all requested actions finish.',
    'Use the JSON response requests field as the machine-readable source when available; this stdout keeps a compact executable copy for --only-instructions mode.',
    '',
    'Current host requests:',
    requests.map(requestInstructionBlock).join('\n'),
  ].join('\n');
}

function orchestratorInstructionForNeedsHostActions({ requests, inlineInstructions, continueCommand }) {
  const continuation = inlineInstructions
    ? []
    : [
        'Then run this single continue command after every current request has submitted completed output or a stop resolution. Replace every <agent-id> placeholder with the actual selected worker id, and replace the debug JSON placeholder with a concise orchestrator debug summary covering completed host actions, rationale, commands/tools used, validation/evidence, and remaining risks or blockers. Do not include private prompts, hidden reasoning, tokens, or raw transcripts.',
        continueCommand,
      ];
  return [
    SUPERSEDES_STDOUT_INSTRUCTION,
    hostRequestInstructionList(requests),
    inlineInstructions,
    ...continuation,
    'Follow that stdout instruction exactly.',
  ].filter(Boolean).join('\n');
}

function terminalOrchestratorInstruction() {
  return [
    SUPERSEDES_STDOUT_INSTRUCTION,
    'Stop now. The workflow run is complete.',
    'Do not call another runner command. Report the completed result from the terminal response.',
  ].join('\n');
}

export function workerBindingKeyForStep(stepId, stepDoc) {
  const agent = stepDoc?.agent;
  return typeof agent === 'string' && agent.length > 0 ? agent : stepId;
}

function preferredAgentIdForStep(baton, stepId, stepDoc) {
  const bindings = baton?.workerBindings;
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return null;
  const preferredAgentId = bindings[workerBindingKeyForStep(stepId, stepDoc)];
  return typeof preferredAgentId === 'string' && preferredAgentId.length > 0 ? preferredAgentId : null;
}

function workflowStepIdForExecutableStep(step) {
  return step.parentStepId ?? step.ownerStepId ?? step.id;
}

function sourceWorkerForExecutableStep(workflow, step) {
  const source = workflow?.steps?.[workflowStepIdForExecutableStep(step)];
  if (source?.kind === 'worker') return source;
  if (source?.kind === 'shard') return step.shard?.index === undefined ? source : source.worker;
  if (source?.kind === 'fanout') return step.fanout?.branch_id ? source.branches?.[step.fanout.branch_id] : source;
  return undefined;
}

function agentRuntimeForExecutableStep(workflow, step, claimContext) {
  const sourceWorker = sourceWorkerForExecutableStep(workflow, step);
  if (typeof sourceWorker?.agent !== 'string' || sourceWorker.agent.length === 0) return undefined;
  const harness = claimContext?.harness;
  if (typeof harness !== 'string' || harness.length === 0) return undefined;
  const profiles = sourceWorker.agent_runtime;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) return undefined;
  const profileKey = Object.keys(profiles).find((key) => key.toLowerCase() === harness.toLowerCase());
  if (profileKey === undefined) return undefined;
  const profile = profiles[profileKey];
  return { model: profile.model, thinkingLevel: profile.thinking_level };
}

function nonBlockingStopForStep(baton, stepId, options = {}) {
  const stop = baton?.nonBlockingStops?.[stepId];
  if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return undefined;
  return publicNonBlockingStopDetails(stop, { stepId, runsRoot: options.runsRoot });
}

function requestForPlan(plan, interpreterResponse, { runId, workflow, runsRoot, leaseToken, claimContext }) {
  const step = plan.entry;
  const nonBlockingStop = nonBlockingStopForStep(interpreterResponse.baton, step.id, { runsRoot });
  if (plan.action === RESOLVE_NON_BLOCKING_STOP_ACTION) {
    return {
      id: step.id,
      stepId: step.id,
      action: RESOLVE_NON_BLOCKING_STOP_ACTION,
      nonBlockingStop,
      resolveStopCommand: resolveStopCommandForStep(runId, step.id, { runsRoot, leaseToken }),
    };
  }

  const request = {
    id: step.id,
    stepId: step.id,
    ...(step.parentStepId ? { parentStepId: step.parentStepId } : {}),
    ...(step.ownerStepId ? { ownerStepId: step.ownerStepId } : {}),
    action: plan.action,
    loadInstructionsCommand: loadInstructionsCommandForStep(runId, step.id, { runsRoot, leaseToken }),
  };
  if (step.shard) request.shard = structuredClone(step.shard);
  if (step.fanout) request.fanout = structuredClone(step.fanout);
  if (plan.action === 'run_worker') {
    const agentRuntime = agentRuntimeForExecutableStep(workflow, step, claimContext);
    if (agentRuntime) request.agentRuntime = agentRuntime;
    const bindingStepId = step.parentStepId || step.ownerStepId ? step.id : workflowStepIdForExecutableStep(step);
    request.preferredAgentId = preferredAgentIdForStep(
      interpreterResponse.baton,
      bindingStepId,
      step.parentStepId || step.ownerStepId ? undefined : step.step,
    );
    request.loadFollowupInstructionsCommand = loadFollowupInstructionsCommandForStep(runId, step.id, { runsRoot, leaseToken });
    if (nonBlockingStop) request.nonBlockingStop = nonBlockingStop;
  }
  return request;
}

export function buildHostRequests(interpreterResponse, options) {
  if (responseStatusForInterpreterResponse(interpreterResponse) !== 'needs_host_actions') return [];
  const plans = projectHostActions(
    interpreterResponse.steps.filter((step) => !TERMINAL_ACTIONS.has(step.action)),
    interpreterResponse.baton,
  );
  return plans.map((plan) => requestForPlan(plan, interpreterResponse, options));
}

function continueCommandForRequests(runId, requests, { runsRoot, leaseToken } = {}) {
  return continueInstructionCommandForRun(runId, {
    runsRoot,
    leaseToken,
    bindAgentSteps: requests.filter((request) => request.action === 'run_worker').map((request) => request.stepId),
    includeOrchestratorDebug: true,
  });
}

export function approvalInstructionsForEntry(entry, {
  baton,
  resources,
  requests = [],
  runId,
  runsRoot,
  leaseToken,
} = {}) {
  return renderApprovalInstructions({
    baton,
    stepId: entry.id,
    step: entry.step,
    resources,
    writeOutputCommand: writeOutputCommandForStep(runId, entry.id, { runsRoot, leaseToken }),
    continueCommand: continueCommandForRequests(runId, requests, { runsRoot, leaseToken }),
    nonBlockingStop: nonBlockingStopForStep(baton, entry.id, { runsRoot }),
  });
}

function inlineApprovalInstructions(interpreterResponse, requests, options) {
  const requestByStep = new Map(requests.map((request) => [request.stepId, request]));
  return interpreterResponse.steps
    .filter((entry) => requestByStep.get(entry.id)?.action === 'wait_for_approval')
    .map((entry) => approvalInstructionsForEntry(entry, {
      baton: interpreterResponse.baton,
      resources: options.resources,
      requests,
      runId: options.runId,
      runsRoot: options.runsRoot,
      leaseToken: options.leaseToken,
    }))
    .join('\n\n');
}

export function toHostResponse(interpreterResponse, options) {
  const status = responseStatusForInterpreterResponse(interpreterResponse);
  const requests = status === 'needs_host_actions' ? buildHostRequests(interpreterResponse, options) : [];
  const response = {
    status,
    orchestratorInstruction: status === 'done'
      ? terminalOrchestratorInstruction()
      : orchestratorInstructionForNeedsHostActions({
          requests,
          inlineInstructions: options.includeInlineInstructions
            ? inlineApprovalInstructions(interpreterResponse, requests, options)
            : '',
          continueCommand: continueCommandForRequests(options.runId, requests, options),
        }),
    baton: interpreterResponse.baton,
    ...(status === 'needs_host_actions' ? { requests } : {}),
  };
  assertRunnerHostResponseSchema(response);
  return response;
}
