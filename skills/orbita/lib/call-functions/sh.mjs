import { runJsonSubprocess } from './subprocess.mjs';

const DEFAULT_TIMEOUT_MS = 120000;

export function executeSh({ argumentsValue }) {
  return runJsonSubprocess({
    command: '/bin/sh',
    args: ['-c', argumentsValue.script],
    stdin: JSON.stringify(argumentsValue.input ?? null),
    timeoutMs: argumentsValue.timeout_ms ?? DEFAULT_TIMEOUT_MS,
  });
}
