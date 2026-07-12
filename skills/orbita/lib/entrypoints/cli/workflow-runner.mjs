#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { WorkflowRuntimeError } from '../../errors.mjs';
import { continueRun, listPointerTransitions, loadInstructions, movePointer, next, reportStop, resolveStop, writeOutput } from '../workflow-runner-command.mjs';
import { publicErrorMessage } from '../../public-error.mjs';


function fail(message) {
  console.error(`workflow-runner: ${publicErrorMessage(message)}`);
  process.exit(1);
}

function usage() {
  return 'usage: bun ./lib/entrypoints/cli/workflow-runner.mjs next --run-id <id> [--workflow <workflow-file>] [--runs-root <dir>] [--diagnostics] [--only-instructions] [--user-prompt <text> | --user-prompt-file <path>] [--lease-token <token> + diagnostics metadata] | continue --run-id <id> [--workflow <workflow-file>] [--runs-root <dir>] [--diagnostics] [--only-instructions] [--bind-agent <step-id=agent-id>...] [--orchestrator-debug-json <json> | --orchestrator-debug-file <path>] [--lease-token <token> + diagnostics metadata] | instructions --run-id <id> --step-id <id> [--follow-up] [--workflow <workflow-file>] [--runs-root <dir>] [--lease-token <token> + diagnostics metadata] | write-output|report-stop|resolve-stop --run-id <id> --step-id <id> [--json <json>] [--debug-summary-file <path> for write-output] [--workflow <workflow-file>] [--runs-root <dir>] [--lease-token <token> + diagnostics metadata] | list-pointer-transitions --run-id <id> [--workflow <workflow-file>] [--runs-root <dir>] [--lease-token <token> + diagnostics metadata] | move-pointer --run-id <id> --transition-id <id> [--workflow <workflow-file>] [--runs-root <dir>] [--lease-token <token> + diagnostics metadata]';
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function parseCliArgs(argv) {
  const [mode, ...rest] = argv;
  if (!['next', 'continue', 'instructions', 'write-output', 'report-stop', 'resolve-stop', 'list-pointer-transitions', 'move-pointer'].includes(mode)) fail(usage());
  try {
    const parsed = parseArgs({
      args: rest,
      options: {
        'run-id': { type: 'string' },
        'step-id': { type: 'string' },
        workflow: { type: 'string' },
        'runs-root': { type: 'string' },
        diagnostics: { type: 'boolean', default: false },
        'only-instructions': { type: 'boolean', default: false },
        json: { type: 'string' },
        'follow-up': { type: 'boolean', default: false },
        'user-prompt': { type: 'string' },
        'user-prompt-file': { type: 'string' },
        'debug-summary-file': { type: 'string' },
        'orchestrator-debug-json': { type: 'string' },
        'orchestrator-debug-file': { type: 'string' },
        'bind-agent': { type: 'string', multiple: true },
        'transition-id': { type: 'string' },
        owner: { type: 'string' },
        harness: { type: 'string' },
        'session-id': { type: 'string' },
        'worker-id': { type: 'string' },
        'agent-id': { type: 'string' },
        'lease-token': { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
    const hasTransitionId = parsed.values['transition-id'] !== undefined;
    if (!parsed.values['run-id']) fail(usage());
    if (['instructions', 'write-output', 'report-stop', 'resolve-stop'].includes(mode) && !parsed.values['step-id']) fail(usage());
    if (!['instructions', 'write-output', 'report-stop', 'resolve-stop'].includes(mode) && parsed.values['step-id']) fail(usage());
    if (parsed.values['agent-id']) fail(usage());
    if (mode !== 'next' && (parsed.values['user-prompt'] !== undefined || parsed.values['user-prompt-file'] !== undefined)) fail(usage());
    if (mode === 'instructions' && parsed.values.diagnostics) fail(usage());
    if (mode !== 'instructions' && parsed.values['follow-up']) fail(usage());
    if (!['next', 'continue'].includes(mode) && parsed.values['only-instructions']) fail(usage());
    if (!['write-output', 'report-stop', 'resolve-stop'].includes(mode) && parsed.values.json !== undefined) fail(usage());
    if (mode !== 'write-output' && parsed.values['debug-summary-file'] !== undefined) fail(usage());
    if (mode !== 'continue' && parsed.values['orchestrator-debug-json'] !== undefined) fail(usage());
    if (mode !== 'continue' && parsed.values['orchestrator-debug-file'] !== undefined) fail(usage());
    if (parsed.values['orchestrator-debug-json'] !== undefined && parsed.values['orchestrator-debug-file'] !== undefined) fail(usage());
    if (mode !== 'continue' && parsed.values['bind-agent'] !== undefined) fail(usage());
    if (!['next', 'continue'].includes(mode) && parsed.values.diagnostics) fail(usage());
    if (mode === 'move-pointer' && !hasTransitionId) fail(usage());
    if (mode !== 'move-pointer' && hasTransitionId) fail(usage());
    return { mode, values: parsed.values };
  } catch (error) {
    fail(`${error.message}\n${usage()}`);
  }
}

function leaseArgs(values) {
  return {
    owner: values.owner,
    harness: values.harness,
    sessionId: values['session-id'],
    workerId: values['worker-id'],
    leaseToken: values['lease-token'],
  };
}

function writeHostResponse(response, { onlyInstructions }) {
  if (onlyInstructions) {
    process.stdout.write(`${response.orchestratorInstruction}\n`);
    return;
  }
  console.log(JSON.stringify(response, null, 2));
}

try {
  const { mode, values } = parseCliArgs(process.argv.slice(2));
  if (mode === 'instructions') {
    const instructions = await loadInstructions({
      runId: values['run-id'],
      workflowPath: values.workflow,
      runsRoot: values['runs-root'],
      stepId: values['step-id'],
      followUp: values['follow-up'],
      ...leaseArgs(values),
    });
    process.stdout.write(instructions);
  } else if (mode === 'write-output') {
    const response = await writeOutput({
      runId: values['run-id'],
      workflowPath: values.workflow,
      runsRoot: values['runs-root'],
      stepId: values['step-id'],
      json: values.json ?? await readStdin(),
      debugSummaryFile: values['debug-summary-file'],
      ...leaseArgs(values),
    });
    console.log(JSON.stringify(response, null, 2));
  } else if (mode === 'report-stop' || mode === 'resolve-stop') {
    const command = mode === 'report-stop' ? reportStop : resolveStop;
    const response = await command({
      runId: values['run-id'],
      workflowPath: values.workflow,
      runsRoot: values['runs-root'],
      stepId: values['step-id'],
      json: values.json ?? await readStdin(),
      ...leaseArgs(values),
    });
    console.log(JSON.stringify(response, null, 2));
  } else if (mode === 'list-pointer-transitions') {
    const response = await listPointerTransitions({
      runId: values['run-id'],
      workflowPath: values.workflow,
      runsRoot: values['runs-root'],
      ...leaseArgs(values),
    });
    console.log(JSON.stringify(response, null, 2));
  } else if (mode === 'move-pointer') {
    const response = await movePointer({
      runId: values['run-id'],
      workflowPath: values.workflow,
      runsRoot: values['runs-root'],
      transitionId: values['transition-id'],
      ...leaseArgs(values),
    });
    console.log(JSON.stringify(response, null, 2));
  } else {
    const command = mode === 'next' ? next : continueRun;
    const response = await command({
      runId: values['run-id'],
      workflowPath: values.workflow,
      runsRoot: values['runs-root'],
      includeDiagnostics: values.diagnostics,
      userPrompt: values['user-prompt'],
      userPromptFile: values['user-prompt-file'],
      bindAgents: values['bind-agent'],
      orchestratorDebugJson: values['orchestrator-debug-json'],
      orchestratorDebugFile: values['orchestrator-debug-file'],
      ...leaseArgs(values),
    });
    writeHostResponse(response, { onlyInstructions: values['only-instructions'] });
  }
} catch (error) {
  if (error instanceof WorkflowRuntimeError) fail(error.message);
  fail(error.message);
}
