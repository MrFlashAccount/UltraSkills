import { fileURLToPath } from 'node:url';
import { runJsonSubprocess } from './subprocess.mjs';

const JS_WORKER_PATH = fileURLToPath(new URL('./js-worker.mjs', import.meta.url));
const DEFAULT_TIMEOUT_MS = 120000;

export function executeJs({ argumentsValue }) {
  return runJsonSubprocess({
    command: process.execPath,
    args: [JS_WORKER_PATH],
    stdin: JSON.stringify({ source: argumentsValue.source, input: argumentsValue.input ?? null }),
    timeoutMs: argumentsValue.timeout_ms ?? DEFAULT_TIMEOUT_MS,
  });
}
