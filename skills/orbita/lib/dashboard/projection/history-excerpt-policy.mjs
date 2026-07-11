import { HISTORY_EXCERPT_LIMITS } from '../contracts/dashboard-contracts.mjs';
import { safeDashboardScalar } from './safe-dashboard-scalar.mjs';

const SENSITIVE_LINE = [
  /workflow-runner\.mjs['"]?\s+instructions\b/i,
  /\binstructions\s+--run-id\b/i,
  /load the step instructions/i,
  /private prompt/i,
  /hidden transcript/i,
  /\bbind-agent\b/i,
  /\bpreferred agent\b/i,
];

const TOKEN_PATTERNS = [
  /(--lease-token(?:=|\s+))(?:"[^"]*"|'[^']*'|[^\s'"]+)/gi,
  /(WORKFLOW_RUN_TOKEN=)(?:"[^"]*"|'[^']*'|[^\s'"]+)/gi,
  /([?&]leaseToken=)[^&\s]+/gi,
];

function normalizeText(value) {
  return String(value ?? '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\0', '')
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n')
    .trim();
}

function redactLine(line) {
  let value = line;
  for (const pattern of TOKEN_PATTERNS) value = value.replaceAll(pattern, '$1[redacted]');
  return safeDashboardScalar(value.replaceAll(/(\.workflow-runner\/instructions\/)[^\s'")]+/gi, '$1[redacted]'));
}

function truncateUtf8Tail(value, maxBytes) {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return { text: value, truncated: false };
  let bytes = 0;
  let text = '';
  for (const char of [...value].reverse()) {
    const next = Buffer.byteLength(char, 'utf8');
    if (bytes + next > maxBytes) break;
    bytes += next;
    text = char + text;
  }
  return { text: text.trimStart(), truncated: true };
}

export function buildHistoryExcerpt(history, limits = HISTORY_EXCERPT_LIMITS) {
  const text = history?.mode === 'embedded-text' ? history.text : '';
  const normalized = normalizeText(text);
  if (normalized.length === 0) return { lines: [], truncated: false };
  const safeLines = normalized
    .split('\n')
    .filter((line) => !SENSITIVE_LINE.some((pattern) => pattern.test(line)))
    .map(redactLine);
  const lineLimited = safeLines.slice(-limits.lines);
  const lineTruncated = safeLines.length > lineLimited.length;
  const byteLimited = truncateUtf8Tail(lineLimited.join('\n'), limits.bytes);
  return {
    lines: byteLimited.text.length === 0 ? [] : byteLimited.text.split('\n'),
    truncated: lineTruncated || byteLimited.truncated,
  };
}
