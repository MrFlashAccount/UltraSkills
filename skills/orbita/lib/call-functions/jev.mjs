import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

const DEFAULT_TIMEOUT_MS = 120000;
const JEV_MODEL_ID = 'typesafe-ai/jev';

function timeoutError(timeoutMs) {
  return new Error(`Jev request exceeded timeout of ${timeoutMs}ms`);
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

async function readApiKey(credentialPath, { readFileImpl, signal }) {
  let content;
  try {
    content = await readFileImpl(credentialPath, { encoding: 'utf8', signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    const code = typeof error?.code === 'string' ? ` (${error.code})` : '';
    throw new Error(`Jev gateway API key file could not be read${code}`);
  }
  const apiKey = String(content).trim();
  if (!apiKey) throw new Error('Jev gateway API key file is empty');
  return apiKey;
}

async function requestEvaluation({ argumentsValue, credentialPath }, {
  controller,
  loadAiSdk,
  fetchImpl,
  readFileImpl,
}) {
  const apiKey = await readApiKey(credentialPath, { readFileImpl, signal: controller.signal });
  try {
    const { createGateway, experimental_evaluate: evaluate } = await loadAiSdk();
    const gateway = createGateway({ apiKey, fetch: fetchImpl });
    const result = await evaluate({
      model: gateway.evaluationModel(JEV_MODEL_ID),
      state: argumentsValue.state,
      questions: argumentsValue.questions,
      maxRetries: 0,
      abortSignal: controller.signal,
    });
    return result.answers;
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error('Jev evaluation request failed');
  }
}

export async function executeJev({ argumentsValue, workflowPath }, {
  fetchImpl = fetch,
  loadAiSdk = () => import('ai'),
  readFileImpl = readFile,
} = {}) {
  const credentialPath = isAbsolute(argumentsValue.api_key_file)
    ? argumentsValue.api_key_file
    : resolve(dirname(workflowPath), argumentsValue.api_key_file);
  const controller = new AbortController();
  const timeoutMs = argumentsValue.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  let didTimeout = false;
  let timer;
  const timeout = new Promise((_, rejectTimeout) => {
    timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
      rejectTimeout(timeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      requestEvaluation({ argumentsValue, credentialPath }, {
        controller,
        loadAiSdk,
        fetchImpl,
        readFileImpl,
      }),
      timeout,
    ]);
  } catch (error) {
    if (didTimeout || isAbortError(error)) throw timeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
