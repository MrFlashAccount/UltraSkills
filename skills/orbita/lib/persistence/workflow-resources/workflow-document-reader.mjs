import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parse as parseTomlPortable } from 'smol-toml';
import { WorkflowRuntimeError } from '../../errors.mjs';

function parseWorkflowJson(content, kind) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new WorkflowRuntimeError(`failed to read ${kind} JSON: ${error.message}`);
  }
}

function parseWorkflowToml(content, kind) {
  try {
    const parse = globalThis.Bun?.TOML?.parse ?? parseTomlPortable;
    return parse(content);
  } catch (error) {
    throw new WorkflowRuntimeError(`failed to read ${kind} TOML: ${error.message}`);
  }
}

export function parseWorkflowDocument(content, pathname, kind = 'workflow') {
  const extension = extname(pathname);
  if (extension === '.json') return parseWorkflowJson(content, kind);
  if (extension === '.toml') return parseWorkflowToml(content, kind);
  throw new WorkflowRuntimeError(`failed to read ${kind}: unsupported workflow file extension '${extension || '<none>'}'`);
}

export function readWorkflowDocument(pathname, kind = 'workflow') {
  const extension = extname(pathname);
  let content;
  try {
    content = readFileSync(pathname, 'utf8');
  } catch (error) {
    const code = typeof error?.code === 'string' ? `: ${error.code}` : '';
    const format = extension === '.toml' ? 'TOML' : 'JSON';
    throw new WorkflowRuntimeError(`failed to read ${kind} ${format}${code}`);
  }
  return parseWorkflowDocument(content, pathname, kind);
}
