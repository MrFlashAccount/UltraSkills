const MAX_TEXT_LENGTH = 512;
const MAX_EVIDENCE_ITEMS = 5;
const PATH_TOKEN = /(?:^|[\s'"`(=])([^\s'"`)]+)/g;
const TRAILING_PUNCTUATION = /[,:;.!?]+$/;

function normalizeComparablePath(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .toLowerCase();
}

function uniqueRoots(roots) {
  const seen = new Set();
  const result = [];
  for (const root of roots) {
    if (typeof root !== 'string' || root.length === 0) continue;
    const normalized = normalizeComparablePath(root);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ raw: root, normalized });
  }
  return result;
}

function privateRoots({ runsRoot } = {}) {
  return uniqueRoots([runsRoot, process.env.WORKFLOW_RUNS_ROOT]);
}

function relativePrivatePath(pathname, roots) {
  const normalizedPathname = normalizeComparablePath(pathname);
  for (const root of roots) {
    if (normalizedPathname === root.normalized) return '';
    if (normalizedPathname.startsWith(`${root.normalized}/`)) return normalizedPathname.slice(root.normalized.length + 1);
  }
  return undefined;
}

function replacementForPrivatePath(relativePath) {
  if (relativePath === 'runs.json' || relativePath === '.runs.json.lock') return 'workflow runs index';
  if (/^[^/]+\/history\.md$/.test(relativePath)) return 'workflow history private state';
  if (/^[^/]+\/baton\.json$/.test(relativePath)) return 'workflow baton private state';
  return 'workflow run private state';
}

function replacementForLocalPath(pathname) {
  const normalized = normalizeComparablePath(pathname);
  if (/^(?:file:\/|~\/|\.\.?\/|[a-z]:\/|\/)/i.test(normalized)) return 'local filesystem path';
  return undefined;
}

function redactPrivatePathToken(token, roots) {
  const trailing = token.match(TRAILING_PUNCTUATION)?.[0] ?? '';
  const pathname = trailing ? token.slice(0, -trailing.length) : token;
  const relativePath = relativePrivatePath(pathname, roots);
  if (relativePath !== undefined) return `${replacementForPrivatePath(relativePath)}${trailing}`;
  const localPathReplacement = replacementForLocalPath(pathname);
  if (localPathReplacement) return `${localPathReplacement}${trailing}`;
  return token;
}

function redactPrivatePaths(value, options = {}) {
  const roots = privateRoots(options);
  return String(value).replaceAll(PATH_TOKEN, (match, token) => {
    const prefixLength = match.length - token.length;
    return `${match.slice(0, prefixLength)}${redactPrivatePathToken(token, roots)}`;
  });
}

function boundedText(value, fallback = '', options = {}) {
  const text = String(value ?? fallback)
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\0', '')
    .trim();
  return redactSensitiveText(redactPrivatePaths(text, options)).slice(0, MAX_TEXT_LENGTH).trim();
}

function redactSensitiveText(value) {
  return String(value ?? '')
    .replace(/(--lease-token(?:=|\s+))(?:"[^"]*"|'[^']*'|[^\s'"]+)/g, '$1[redacted-lease-token]')
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[redacted-aws-access-key]')
    .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,'";]+)/gi, '$1=[redacted]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted-token]')
    .replace(/(?:[A-Za-z]:)?[^\s]*\.workflow-runner[^\s]*/g, '[redacted-workflow-runner-private-state]')
    .replace(/\/Users\/[^\s]*\.orbita\/workflow-runs[^\s]*/g, '[redacted-workflow-runs-private-state]');
}

export function publicNonBlockingStopDetails(stop, { stepId, runsRoot } = {}) {
  const options = { runsRoot };
  const stopId = String(stop?.stop_id ?? '');
  const sourceStepId = boundedText(stop?.source_step_id ?? stepId, stepId, options);
  const needed = boundedText(stop?.needed ?? stop?.summary, 'Help is required before this request can continue.', options);
  const summary = boundedText(stop?.summary ?? needed, needed, options);
  const details = {
    stop_id: stopId,
    summary,
    source_step_id: sourceStepId,
    needed,
  };

  if (Array.isArray(stop?.evidence)) {
    const evidence = stop.evidence
      .slice(0, MAX_EVIDENCE_ITEMS)
      .map((entry) => boundedText(entry, '', options))
      .filter(Boolean);
    if (evidence.length > 0) details.evidence = evidence;
  }

  const risk = boundedText(stop?.risk, '', options);
  if (risk) details.risk = risk;

  if (stop?.resolution && typeof stop.resolution === 'object' && !Array.isArray(stop.resolution)) {
    details.resolution = publicStopResolutionDetails(stop.resolution, options);
  }

  return details;
}

export function publicStopResolutionDetails(output, { runsRoot } = {}) {
  const options = { runsRoot };
  const resolution = output?.resolution && typeof output.resolution === 'object' && !Array.isArray(output.resolution)
    ? output.resolution
    : output;
  const summary = boundedText(resolution?.summary ?? resolution?.decision, 'The orchestrator resolved the non-blocking stop.', options);
  const decision = boundedText(resolution?.decision ?? resolution?.answer ?? summary, summary, options);
  const details = { summary, decision };

  if (Array.isArray(resolution?.evidence)) {
    const evidence = resolution.evidence
      .slice(0, MAX_EVIDENCE_ITEMS)
      .map((entry) => boundedText(entry, '', options))
      .filter(Boolean);
    if (evidence.length > 0) details.evidence = evidence;
  }

  const risk = boundedText(resolution?.risk, '', options);
  if (risk) details.risk = risk;

  return details;
}
