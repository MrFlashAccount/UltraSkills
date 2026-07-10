import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'bun:test';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(currentFilePath);
const allowedCliSuites = new Set([
  'workflow-catalog.test.mjs',
  'workflow-runid-runtime.test.mjs',
  'workflow-runner-cli.test.mjs',
  'workflow-runs-api.test.mjs',
]);

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(entryPath);
    return entry.name.endsWith('.test.mjs') ? [entryPath] : [];
  });
}

test('test boundary: subprocess APIs remain confined to explicit CLI suites', () => {
  const unexpected = testFiles(testsDir)
    .filter((filePath) => filePath !== currentFilePath)
    .filter((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      return /node:child_process|\bBun\.(?:spawn|spawnSync)\b/.test(source);
    })
    .map((filePath) => path.relative(testsDir, filePath))
    .filter((relativePath) => !allowedCliSuites.has(relativePath))
    .sort();

  assert.deepEqual(unexpected, [], `move semantic tests to the in-process production API; update the allowlist only for CLI-only contracts`);
});
