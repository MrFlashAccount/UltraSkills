import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

export const HOST_JSON_INPUT_MAX_BYTES = 1024 * 1024;

function limitError(label) {
  return new Error(`${label} exceeds the ${HOST_JSON_INPUT_MAX_BYTES}-byte limit`);
}

export function assertBoundedHostJsonText(value, { label = 'host JSON input' } = {}) {
  const text = String(value ?? '');
  if (Buffer.byteLength(text, 'utf8') > HOST_JSON_INPUT_MAX_BYTES) throw limitError(label);
  return text;
}

export async function readBoundedHostJsonStream(stream, { label = 'host JSON stdin' } = {}) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > HOST_JSON_INPUT_MAX_BYTES) {
      stream.destroy?.();
      throw limitError(label);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, bytes).toString('utf8');
}

export async function readBoundedHostJsonFile(pathname, { label = 'orchestrator debug JSON file' } = {}) {
  const flags = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0);
  let handle;
  try {
    handle = await open(pathname, flags);
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
    if (stats.size > HOST_JSON_INPUT_MAX_BYTES) throw limitError(label);
    const buffer = Buffer.alloc(HOST_JSON_INPUT_MAX_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > HOST_JSON_INPUT_MAX_BYTES) throw limitError(label);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } catch (error) {
    if (error?.message?.startsWith(label)) throw error;
    const code = typeof error?.code === 'string' ? `: ${error.code}` : '';
    throw new Error(`failed to read ${label}${code}`);
  } finally {
    await handle?.close();
  }
}
