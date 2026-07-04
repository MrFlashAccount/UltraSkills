import {
  bindAgent,
  continueRun,
  listPointerTransitions,
  loadInstructions,
  movePointer,
  next,
  recordOrchestrator,
  writeOutput,
} from '../../entrypoints/workflow-runner-command.mjs';
import { publicErrorMessage } from '../../public-error.mjs';

function valueAfter(args, name) {
  const exactIndex = args.indexOf(name);
  if (exactIndex >= 0) return args[exactIndex + 1];
  const prefix = `${name}=`;
  const inline = args.find((arg) => typeof arg === 'string' && arg.startsWith(prefix));
  return inline === undefined ? undefined : inline.slice(prefix.length);
}

function hasFlag(args, name) {
  return args.includes(name) || args.some((arg) => typeof arg === 'string' && arg === `${name}=true`);
}

function jsonStdout(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function leaseArgs(args, env) {
  return {
    owner: valueAfter(args, '--owner'),
    harness: valueAfter(args, '--harness'),
    sessionId: valueAfter(args, '--session-id'),
    workerId: valueAfter(args, '--worker-id'),
    leaseToken: valueAfter(args, '--lease-token') ?? env.WORKFLOW_RUN_TOKEN,
  };
}

export async function runWorkflowRunnerApi(args, options = {}) {
  const [mode] = args;
  const env = { ...process.env, ...(options.env ?? {}) };
  const common = {
    runId: valueAfter(args, '--run-id'),
    workflowPath: valueAfter(args, '--workflow'),
    runsRoot: valueAfter(args, '--runs-root') ?? env.WORKFLOW_RUNS_ROOT,
    ...leaseArgs(args, env),
  };

  try {
    if (mode === 'instructions') {
      const instructions = await loadInstructions({
        ...common,
        stepId: valueAfter(args, '--step-id'),
        followUp: hasFlag(args, '--follow-up'),
      });
      return { status: 0, stdout: instructions, stderr: '' };
    }
    if (mode === 'bind-agent') {
      await bindAgent({
        ...common,
        stepId: valueAfter(args, '--step-id'),
        agentId: valueAfter(args, '--agent-id'),
      });
      return { status: 0, stdout: '', stderr: '' };
    }
    if (mode === 'write-output') {
      const response = await writeOutput({
        ...common,
        stepId: valueAfter(args, '--step-id'),
        json: valueAfter(args, '--json') ?? options.input ?? '',
        debugSummaryFile: valueAfter(args, '--debug-summary-file'),
      });
      return { status: 0, stdout: jsonStdout(response), stderr: '' };
    }
    if (mode === 'record-orchestrator') {
      const response = await recordOrchestrator({
        ...common,
        json: valueAfter(args, '--json') ?? options.input ?? '',
      });
      return { status: 0, stdout: jsonStdout(response), stderr: '' };
    }
    if (mode === 'list-pointer-transitions') {
      const response = await listPointerTransitions(common);
      return { status: 0, stdout: jsonStdout(response), stderr: '' };
    }
    if (mode === 'move-pointer') {
      const response = await movePointer({
        ...common,
        transitionId: valueAfter(args, '--transition-id'),
        acknowledgeRetainedState: hasFlag(args, '--acknowledge-retained-state'),
      });
      return { status: 0, stdout: jsonStdout(response), stderr: '' };
    }
    if (mode === 'next' || mode === 'continue') {
      const command = mode === 'next' ? next : continueRun;
      const response = await command({
        ...common,
        includeDiagnostics: hasFlag(args, '--diagnostics'),
        userPrompt: valueAfter(args, '--user-prompt'),
        userPromptFile: valueAfter(args, '--user-prompt-file'),
        output: valueAfter(args, '--output') === undefined ? undefined : [valueAfter(args, '--output')],
      });
      if (hasFlag(args, '--only-instructions')) {
        return { status: 0, stdout: `${response.orchestratorInstruction}\n`, stderr: '' };
      }
      return { status: 0, stdout: jsonStdout(response), stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'workflow-runner: unsupported test runner mode\n' };
  } catch (error) {
    return {
      status: 1,
      stdout: '',
      stderr: `workflow-runner: ${publicErrorMessage(error?.message ?? error)}\n`,
    };
  }
}
