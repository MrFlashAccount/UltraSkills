import {
  bindAgent,
  continueRun,
  listPointerTransitions,
  loadInstructions,
  movePointer,
  next,
  recordOrchestrator,
  writeOutput,
} from './orbita-production-api.mjs';
import { claimWorkflowRunAtRoot, registerWorkflowRunAtRoot } from '../../persistence/run-state/workflow-runs.mjs';
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

function valuesAfter(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === name) values.push(args[index + 1]);
    else if (typeof arg === 'string' && arg.startsWith(`${name}=`)) values.push(arg.slice(name.length + 1));
  }
  return values.length > 0 ? values : undefined;
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

async function withTemporaryEnv(env, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(env ?? {})) {
    previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
    if (value === undefined) delete process.env[key];
    else process.env[key] = String(value);
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
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

  return await withTemporaryEnv(options.env, async () => {
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
        bindAgents: valuesAfter(args, '--bind-agent'),
        orchestratorDebugJson: valueAfter(args, '--orchestrator-debug-json'),
        orchestratorDebugFile: valueAfter(args, '--orchestrator-debug-file'),
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
  });
}

export async function claimWorkflowRunForTest(paths, { leaseTokensByRunId, testLeaseToken } = {}) {
  const knownToken = leaseTokensByRunId?.get(paths.runId);
  if (knownToken) {
    process.env.WORKFLOW_RUN_TOKEN = knownToken;
    return knownToken;
  }

  try {
    const created = await registerWorkflowRunAtRoot({
      runId: paths.runId,
      workflowPath: paths.workflowPath,
      runsRoot: paths.runsRoot,
      claim: true,
    });
    leaseTokensByRunId?.set(paths.runId, created.leaseToken);
    process.env.WORKFLOW_RUN_TOKEN = created.leaseToken;
    return created.leaseToken;
  } catch {
    const token = testLeaseToken;
    let claimed = await claimWorkflowRunAtRoot({
      runId: paths.runId,
      workflowPath: paths.workflowPath,
      runsRoot: paths.runsRoot,
      leaseToken: token,
    });
    if (!claimed.ok && claimed.reason === 'occupied') {
      claimed = await claimWorkflowRunAtRoot({
        runId: paths.runId,
        workflowPath: paths.workflowPath,
        runsRoot: paths.runsRoot,
        takeover: true,
      });
    }
    if (!claimed.ok) throw new Error(`claim ${paths.runId} failed: ${claimed.reason ?? 'unknown'}`);
    const claimedToken = claimed.leaseToken ?? token;
    leaseTokensByRunId?.set(paths.runId, claimedToken);
    process.env.WORKFLOW_RUN_TOKEN = claimedToken;
    return claimedToken;
  }
}
