const FORBIDDEN_COMMAND = /(?:\b(?:bun|node)\s+)?[^\s]*workflow-runner(?:\.mjs)?\s+(?:instructions|next|continue|write-output|bind-agent)\b[^\r\n]*/gi;
const LEASE_TOKEN = /--lease-token(?:=|\s+)(?:"[^"]*"|'[^']*'|[^\s'"]+)/gi;
const ENV_TOKEN = /\bWORKFLOW_RUN_TOKEN=(?:"[^"]*"|'[^']*'|[^\s'"]+)/gi;
const QUERY_TOKEN = /([?&]leaseToken=)[^&\s]+/gi;
const PRIVATE_INSTRUCTION_REF = /\.workflow-runner\/instructions\/[^\s'")]+/gi;
const ABSOLUTE_PATH = /(^|[\s'"(=])((?:\/(?!\/)[^\s'"`)<>]+)|(?:[A-Za-z]:[\\/][^\s'"`)<>]+))/g;

/** Returns a browser-safe scalar. Dashboard DTO construction must route all strings through here. */
export function safeDashboardScalar(value, { fallback = '' } = {}) {
  if (value === undefined || value === null) return fallback;
  return String(value)
    .replaceAll('\0', '')
    .replaceAll(FORBIDDEN_COMMAND, '[redacted command]')
    .replaceAll(LEASE_TOKEN, '[redacted credential]')
    .replaceAll(ENV_TOKEN, '[redacted credential]')
    .replaceAll(QUERY_TOKEN, '$1[redacted]')
    .replaceAll(PRIVATE_INSTRUCTION_REF, '[redacted instruction reference]')
    .replaceAll(ABSOLUTE_PATH, (_match, prefix) => `${prefix}[redacted path]`);
}
