import { loadOutputSchema } from "../persistence/workflow-resources/output-schema-loader.mjs";
import {
  assertSafeStepId,
  continueInstructionCommandForRun,
  loadFollowupInstructionsCommandForStep,
  loadInstructionsCommandForStep,
  writeOutputCommandForStep,
} from "./runner-command-builder.mjs";
import { publicRecoverableBlockerDetails } from "../runtime/recoverable-worker-blocker.mjs";

const TERMINAL_ACTIONS = new Set(["stop_done"]);
const RESOLVE_WORKER_BLOCKER_ACTION = "resolve_worker_blocker";
const SUPERSEDES_STDOUT_INSTRUCTION =
  "Supersedes all previous workflow-runner stdout.";

export { assertSafeStepId };

export function responseStatusForInterpreterResponse(interpreterResponse) {
  const steps = interpreterResponse.steps ?? [];
  if (steps.length === 1 && steps[0].action === "stop_done") return "done";
  return "needs_host_actions";
}

function requestInstructionBlock(request) {
  const lines = [`- ${request.action}: ${request.id}`];
  if (request.parentStepId) lines.push(`  parent step: ${request.parentStepId}`);
  if (request.ownerStepId) lines.push(`  owner step: ${request.ownerStepId}`);

  if (request.action === "run_worker") {
    if (request.agentRuntime) {
      lines.push(`  For a fresh subagent, use model ${request.agentRuntime.model} with thinking level ${request.agentRuntime.thinkingLevel}.`);
    }
    if (request.preferredAgentId) lines.push(`  preferred worker id: ${request.preferredAgentId}`);
    lines.push(`  fresh-worker instruction-loader command: ${request.loadInstructionsCommand}`);
    lines.push("  send that command to the worker bootstrap; do not run it in the orchestrator");
    if (request.loadFollowupInstructionsCommand) {
      lines.push(`  preferred-worker follow-up instruction-loader command: ${request.loadFollowupInstructionsCommand}`);
      lines.push("  send that command only when restoring the preferred worker; do not run it in the orchestrator");
    }
    lines.push(`  pass actual worker id to continue: --bind-agent '${request.stepId}=<agent-id>'`);
    if (request.recoverableBlocker) lines.push(`  recoverable blocker: ${JSON.stringify(request.recoverableBlocker)}`);
    if (request.shard) lines.push(`  shard: ${JSON.stringify(request.shard)}`);
    if (request.fanout) lines.push(`  fanout: ${JSON.stringify(request.fanout)}`);
    return lines.join("\n");
  }

  if (request.action === "wait_for_approval") {
    if (request.outputSchema) lines.push(`  output schema: ${request.outputSchema}`);
    return lines.join("\n");
  }

  if (request.action === RESOLVE_WORKER_BLOCKER_ACTION) {
    lines.push(`  recoverable blocker: ${JSON.stringify(request.recoverableBlocker)}`);
    lines.push(`  write resolution: ${request.writeResolutionCommand}`);
    return lines.join("\n");
  }

  lines.push(`  request: ${JSON.stringify(request)}`);
  return lines.join("\n");
}

function hostRequestInstructionList(requests = []) {
  if (requests.length === 0) return "Current host requests: none.";
  return [
    "Execute every current host request below and wait until all requested actions finish.",
    "Use the JSON response requests field as the machine-readable source when available; this stdout keeps a compact executable copy for --only-instructions mode.",
    "",
    "Current host requests:",
    requests.map(requestInstructionBlock).join("\n"),
  ].join("\n");
}

const TERMINAL_ORCHESTRATOR_INSTRUCTIONS_BY_STATUS = Object.freeze({
  needs_host_actions: (ctx) => [
    hostRequestInstructionList(ctx.requests),
    ctx.inlineInstructions,
    "Then run this single continue command after every current request has accepted output. Replace every <agent-id> placeholder with the actual selected worker id, and replace the debug JSON placeholder with a concise orchestrator debug summary covering completed host actions, rationale, commands/tools used, validation/evidence, and remaining risks or blockers. Do not include private prompts, hidden reasoning, tokens, or raw transcripts.",
    ctx.continueCommand,
    "Follow that stdout instruction exactly.",
  ].filter(Boolean).join("\n"),
  done: (ctx) =>
    `Stop now. Do not call another runner command. Terminal response JSON: ${JSON.stringify({ status: "done", baton: ctx.baton })}\nReport the completed result from that JSON; status done is the terminal result.`,
});

function orchestratorInstructionForStatus(status, ctx) {
  const instruction = TERMINAL_ORCHESTRATOR_INSTRUCTIONS_BY_STATUS[status];
  if (!instruction)
    throw new Error(`unknown workflow runner host response status: ${status}`);

  return [SUPERSEDES_STDOUT_INSTRUCTION, instruction(ctx)].join("\n");
}

function inlineInstructionForStep(step, { runId, runsRoot, leaseToken } = {}) {
  if (step.action !== "wait_for_approval") return "";
  const prompt = step.compiledPrompt?.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error(`missing compiled approval instructions for workflow step '${step.id}'`);
  }
  const writeOutputCommand = typeof runId === "string" && runId.length > 0
    ? writeOutputCommandForStep(runId, step.id, {
        runsRoot,
        leaseToken,
      })
    : "";
  if (!writeOutputCommand) {
    throw new Error(`missing validating approval writer for workflow step '${step.id}'`);
  }
  const writerFallback = prompt.includes(writeOutputCommand)
    ? ""
    : [
        "After the user decides, normalize the answer to strict JSON and submit it with this validating command:",
        "",
        writeOutputCommand,
      ].join("\n");
  return [
    `Approval request: ${step.id}`,
    "",
    "The orchestrator must execute this approval instruction itself.",
    "The compiled prompt below is the complete user-facing source.",
    "Do not inspect workflow source, runner internals, schema files, or CLI help to reconstruct approval output.",
    writerFallback,
    "",
    prompt.trimEnd(),
  ].join("\n");
}

function inlineInstructionsForSteps(steps = [], options = {}) {
  return steps
    .map((step) => inlineInstructionForStep(step, options))
    .filter(Boolean)
    .join("\n\n");
}

function resolvedOutputSchemaForStep(
  step,
  { workflow, workflowPath, repositoryRoot = process.cwd() },
) {
  const schemaRef = step.step?.output?.schema;
  if (step.action !== "wait_for_approval" || !schemaRef) return undefined;
  const resolved = loadOutputSchema({
    workflow,
    workflowPath,
    schemaRef,
    repositoryRoot,
  });
  return {
    ref: schemaRef,
    schema: resolved.schema,
  };
}

export function workerBindingKeyForStep(stepId, stepDoc) {
  const agent = stepDoc?.agent;
  return typeof agent === "string" && agent.length > 0
    ? agent
    : stepId;
}

function preferredAgentIdForStep(baton, stepId, stepDoc) {
  const bindings = baton?.workerBindings;
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
    return null;
  }
  const preferredAgentId = bindings[workerBindingKeyForStep(stepId, stepDoc)];
  return typeof preferredAgentId === "string" && preferredAgentId.length > 0
    ? preferredAgentId
    : null;
}

function workflowStepIdForExecutableStep(step) {
  return step.parentStepId ?? step.ownerStepId ?? step.id;
}

function sourceWorkerForExecutableStep(workflow, step) {
  const source = workflow?.steps?.[workflowStepIdForExecutableStep(step)];
  if (source?.kind === "worker") return source;
  if (source?.kind === "shard") return step.shard?.index === undefined ? source : source.worker;
  if (source?.kind === "fanout") {
    return step.fanout?.branch_id ? source.branches?.[step.fanout.branch_id] : source;
  }
  return undefined;
}

function agentRuntimeForExecutableStep(workflow, step, claimContext) {
  const sourceWorker = sourceWorkerForExecutableStep(workflow, step);
  if (typeof sourceWorker?.agent !== "string" || sourceWorker.agent.length === 0) return undefined;
  const harness = claimContext?.harness;
  if (typeof harness !== "string" || harness.length === 0) return undefined;
  const profiles = sourceWorker.agent_runtime;
  if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) return undefined;
  const foldedHarness = harness.toLowerCase();
  const profileKey = Object.keys(profiles).find((key) => key.toLowerCase() === foldedHarness);
  if (profileKey === undefined) return undefined;
  const profile = profiles[profileKey];
  return { model: profile.model, thinkingLevel: profile.thinking_level };
}

function recoverableBlockerForStep(baton, stepId, options = {}) {
  const blocker = baton?.recoverableWorkerBlockers?.[stepId];
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) return undefined;
  return publicRecoverableBlockerDetails(blocker, { stepId, runsRoot: options.runsRoot });
}

export function buildHostRequests(
  interpreterResponse,
  { runId, workflow, workflowPath, repositoryRoot, runsRoot, leaseToken, claimContext },
) {
  const status = responseStatusForInterpreterResponse(interpreterResponse);
  if (status !== "needs_host_actions") return [];

  return interpreterResponse.steps
    .filter((step) => !TERMINAL_ACTIONS.has(step.action))
    .map((step) => {
      const recoverableBlocker = recoverableBlockerForStep(interpreterResponse.baton, step.id, { runsRoot });
      if (recoverableBlocker && !interpreterResponse.baton.recoverableWorkerBlockers?.[step.id]?.resolution) {
        return {
          id: step.id,
          stepId: step.id,
          action: RESOLVE_WORKER_BLOCKER_ACTION,
          recoverableBlocker,
          writeResolutionCommand: writeOutputCommandForStep(runId, step.id, {
            runsRoot,
            leaseToken,
          }),
        };
      }
      const request = {
        id: step.id,
        stepId: step.id,
        ...(step.parentStepId ? { parentStepId: step.parentStepId } : {}),
        ...(step.ownerStepId ? { ownerStepId: step.ownerStepId } : {}),
        action: step.action,
        loadInstructionsCommand: loadInstructionsCommandForStep(
          runId,
          step.id,
          { runsRoot, leaseToken },
        ),
      };
      if (step.shard) request.shard = structuredClone(step.shard);
      if (step.fanout) request.fanout = structuredClone(step.fanout);
      if (step.action === "run_worker") {
        const agentRuntime = agentRuntimeForExecutableStep(workflow, step, claimContext);
        if (agentRuntime) request.agentRuntime = agentRuntime;
        request.preferredAgentId = preferredAgentIdForStep(
          interpreterResponse.baton,
          workflowStepIdForExecutableStep(step),
          step.step,
        );
        request.loadFollowupInstructionsCommand =
          loadFollowupInstructionsCommandForStep(runId, step.id, {
            runsRoot,
            leaseToken,
          });
        if (recoverableBlocker) request.recoverableBlocker = recoverableBlocker;
      }
      const resolvedOutputSchema = resolvedOutputSchemaForStep(step, {
        workflow,
        workflowPath,
        repositoryRoot,
      });
      if (resolvedOutputSchema) {
        request.outputSchema = resolvedOutputSchema.ref;
        request.resolvedOutputSchema = resolvedOutputSchema;
      }
      return request;
    });
}

export function toHostResponse(interpreterResponse, options) {
  const status = responseStatusForInterpreterResponse(interpreterResponse);
  const requests =
    status === "needs_host_actions"
      ? buildHostRequests(interpreterResponse, options)
      : [];
  const response = {
    status,
    orchestratorInstruction: orchestratorInstructionForStatus(status, {
      requests,
      inlineInstructions: options.includeInlineInstructions
        ? inlineInstructionsForSteps(interpreterResponse.steps, {
            runId: options.runId,
            runsRoot: options.runsRoot,
            leaseToken: options.leaseToken,
          })
        : "",
      continueCommand: continueInstructionCommandForRun(options.runId, {
        runsRoot: options.runsRoot,
        leaseToken: options.leaseToken,
        bindAgentSteps: requests
          .filter((request) => request.action === "run_worker")
          .map((request) => request.stepId),
        includeOrchestratorDebug: status === "needs_host_actions",
      }),
      baton: interpreterResponse.baton,
    }),
    baton: interpreterResponse.baton,
  };
  if (status === "needs_host_actions")
    response.requests = requests;
  return response;
}
