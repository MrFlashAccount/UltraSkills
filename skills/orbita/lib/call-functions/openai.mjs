import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

const DEFAULT_TIMEOUT_MS = 120000;

function endpointForBaseUrl(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('OpenAI base_url must be an absolute URL');
  }
  if (url.protocol !== 'https:') throw new Error('OpenAI base_url must use HTTPS');
  if (url.username || url.password) throw new Error('OpenAI base_url must not contain credentials');
  if (url.search || url.hash) throw new Error('OpenAI base_url must not contain query parameters or a fragment');
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/responses`;
  return url.toString();
}

function responseOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('OpenAI response did not contain structured output text');
}

function timeoutError(timeoutMs) {
  return new Error(`OpenAI request exceeded timeout of ${timeoutMs}ms`);
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
    throw new Error(`OpenAI API key file could not be read${code}`);
  }
  const apiKey = String(content).trim();
  if (!apiKey) throw new Error('OpenAI API key file is empty');
  return apiKey;
}

async function requestStructuredOutput({ argumentsValue, outputSchema, endpoint, credentialPath }, {
  controller,
  fetchImpl,
  readFileImpl,
}) {
  const apiKey = await readApiKey(credentialPath, { readFileImpl, signal: controller.signal });
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: argumentsValue.model,
        input: argumentsValue.prompt,
        ...(argumentsValue.instructions === undefined ? {} : { instructions: argumentsValue.instructions }),
        ...(argumentsValue.max_output_tokens === undefined ? {} : { max_output_tokens: argumentsValue.max_output_tokens }),
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'workflow_output',
            strict: true,
            schema: outputSchema,
          },
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error('OpenAI request failed before receiving a response');
  }
  if (!response.ok) throw new Error(`OpenAI request failed with HTTP ${response.status}`);
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error('OpenAI response was not valid JSON');
  }
  try {
    return JSON.parse(responseOutputText(payload));
  } catch (error) {
    if (error.message === 'OpenAI response did not contain structured output text') throw error;
    throw new Error('OpenAI structured output was not valid JSON');
  }
}

export async function executeOpenAI({ argumentsValue, outputSchema, workflowPath }, {
  fetchImpl = fetch,
  readFileImpl = readFile,
} = {}) {
  const credentialPath = isAbsolute(argumentsValue.api_key_file)
    ? argumentsValue.api_key_file
    : resolve(dirname(workflowPath), argumentsValue.api_key_file);
  const endpoint = endpointForBaseUrl(argumentsValue.base_url ?? 'https://api.openai.com/v1');
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
      requestStructuredOutput({ argumentsValue, outputSchema, endpoint, credentialPath }, {
        controller,
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
