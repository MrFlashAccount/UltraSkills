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
  if (request.ownerStepId) lines.push(`  owner step: ${request.ownerStepId}`);

  if (request.action === "run_worker") {
    if (request.preferredAgentId) lines.push(`  preferred worker id: ${request.preferredAgentId}`);
    lines.push(`  load fresh instructions: ${request.loadInstructionsCommand}`);
    if (request.loadFollowupInstructionsCommand) {
      lines.push(`  load follow-up instructions when restoring the preferred worker: ${request.loadFollowupInstructionsCommand}`);
    }
    lines.push(`  pass actual worker id to continue: --bind-agent '${request.stepId}=<agent-id>'`);
    if (request.recoverableBlocker) lines.push(`  recoverable blocker: ${JSON.stringify(request.recoverableBlocker)}`);
    if (request.shard) lines.push(`  shard: ${JSON.stringify(request.shard)}`);
    if (request.matrix) lines.push(`  matrix: ${JSON.stringify(request.matrix)}`);
    return lines.join("\n");
  }

  if (request.action === "wait_for_approval") {
    if (request.outputSchema) lines.push(`  output schema: ${request.outputSchema}`);
    lines.push("  use the inline approval request below as the complete approval prompt");
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
  return [
    `Approval request: ${step.id}`,
    "",
    "The orchestrator must execute this approval instruction itself.",
    "Use the following compiled approval prompt as the complete source for the user-facing approval message.",
    "When the compiled approval prompt lists required-read files or prompt input artifact paths, attach those files through the host/platform approval mechanism before asking for a decision.",
    "In Codex/Codex Desktop, attaching means rendering each listed local artifact as a Markdown file link with an absolute target, for example: [reasons-canvas-research.md](/absolute/path/reasons-canvas-research.md). A plain text path, artifact id, or summary is not an attachment.",
    "Do not replace artifact attachments with summaries, plain paths, or inline full artifact bodies. If the host cannot attach or render a file link for a listed artifact, state that capability gap explicitly in the approval message and include the path/reference that could not be attached.",
    "Do not inspect workflow source, runner internals, schema files, or CLI help to reconstruct approval output.",
    writeOutputCommand
      ? [
          "After the user decides, normalize the answer to strict JSON and submit it with this validating command:",
          "",
          writeOutputCommand,
        ].join("\n")
      : "If no validating write-output command is present, stop with a runner contract bug.",
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
  return step.ownerStepId ?? step.id;
}

function recoverableBlockerForStep(baton, stepId, options = {}) {
  const blocker = baton?.recoverableWorkerBlockers?.[stepId];
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) return undefined;
  return publicRecoverableBlockerDetails(blocker, { stepId, runsRoot: options.runsRoot });
}

export function buildHostRequests(
  interpreterResponse,
  { runId, workflow, workflowPath, repositoryRoot, runsRoot, leaseToken },
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
        ...(step.ownerStepId ? { ownerStepId: step.ownerStepId } : {}),
        action: step.action,
        loadInstructionsCommand: loadInstructionsCommandForStep(
          runId,
          step.id,
          { runsRoot, leaseToken },
        ),
      };
      if (step.shard) request.shard = structuredClone(step.shard);
      if (step.matrix) request.matrix = structuredClone(step.matrix);
      if (step.action === "run_worker") {
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
