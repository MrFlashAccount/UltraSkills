import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'bun:test';

if (!process.env.WORKFLOW_RUNS_ROOT) {
  const runsRoot = mkdtempSync(join(tmpdir(), 'orbita-test-workflow-runs-'));
  process.env.WORKFLOW_RUNS_ROOT = runsRoot;
  const cleanup = () => {
    rmSync(runsRoot, { recursive: true, force: true });
  };

  afterAll(cleanup);
  process.once('exit', cleanup);
}
