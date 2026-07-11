import { WorkflowRuntimeError } from '../errors.mjs';

const EXPRESSION_PATTERN = /^\$\{\{\s*([A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*)\s*\}\}$/;
const SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const DEFAULT_ALLOWED_ROOTS = Object.freeze(['output', 'input']);
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function expressionError(source, reason) {
  return new WorkflowRuntimeError(`workflow expression '${source}' is invalid: ${reason}`);
}

export function isExpressionString(value) {
  return typeof value === 'string' && value.includes('${{');
}

export function parsePathExpression(source, { allowedRoots = DEFAULT_ALLOWED_ROOTS } = {}) {
  if (typeof source !== 'string') throw new WorkflowRuntimeError('workflow expression source must be a string');

  const match = source.match(EXPRESSION_PATTERN);
  if (!match) {
    throw expressionError(
      source,
      'v1 supports only a whole-string path expression like ${{ output.next }} or ${{ input.planning_draft.selected_reviewers }}',
    );
  }

  const segments = match[1].split('.');
  const [root, ...path] = segments;
  const allowed = new Set(allowedRoots);
  if (!allowed.has(root)) throw expressionError(source, `root '${root}' is not allowed; use ${[...allowed].join(' or ')}`);
  if (path.length === 0) throw expressionError(source, 'path must include at least one field after the root');

  for (const segment of path) {
    if (!SEGMENT_PATTERN.test(segment)) throw expressionError(source, `path segment '${segment}' is not supported`);
    if (DANGEROUS_KEYS.has(segment)) throw expressionError(source, `path segment '${segment}' is not allowed`);
  }

  return { source, root, path: Object.freeze(path), segments: Object.freeze(segments) };
}
