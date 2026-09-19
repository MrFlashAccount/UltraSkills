import path from 'node:path';
import { runSubprocess } from './subprocess.mjs';

const DEFAULT_TIMEOUT_MS = 120000;

export async function executeExec({ argumentsValue, workflowPath }) {
  const cwd = argumentsValue.cwd === undefined
    ? path.dirname(workflowPath)
    : path.resolve(path.dirname(workflowPath), argumentsValue.cwd);
  const result = await runSubprocess({
    command: argumentsValue.executable,
    args: argumentsValue.args ?? [],
    cwd,
    stdin: argumentsValue.stdin ?? '',
    timeoutMs: argumentsValue.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    captureStderr: true,
  });
  return {
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
