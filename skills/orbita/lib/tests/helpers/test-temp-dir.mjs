import { mkdirSync, rmdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll } from 'bun:test';

export const testRepositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const testRunsBaseRoot = join(testRepositoryRoot, '.testruns');
const testSessionRoot = join(testRunsBaseRoot, `orbita-tests-${process.pid}-${Date.now()}`);
let cleanupRegistered = false;
let sequence = 0;

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const cleanup = () => {
    rmSync(testSessionRoot, { recursive: true, force: true });
    try {
      rmdirSync(testRunsBaseRoot);
    } catch (error) {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error;
    }
  };
  afterAll(cleanup);
  process.once('exit', cleanup);
}

function safeLabel(label) {
  return String(label || 'test').replace(/[^A-Za-z0-9_.-]+/g, '-');
}

export function makeTestDir(label = 'test') {
  registerCleanup();
  const dir = join(testSessionRoot, `${safeLabel(label)}-${++sequence}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function makeTestWorkflowRunsRoot(label = 'workflow-runs') {
  return makeTestDir(label);
}
