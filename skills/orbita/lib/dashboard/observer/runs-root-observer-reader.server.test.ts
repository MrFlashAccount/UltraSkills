import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RunsRootObserverReader } from './runs-root-observer-reader.server';

const roots: string[] = [];
afterAll(async () => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'orbita-dashboard-reader-'));
  roots.push(root);
  const runsRoot = join(root, 'runs');
  await mkdir(runsRoot, { recursive: true });
  const workflowPath = resolve('workflows/dev-harness/workflow.toml');
  const entries = {
    healthy: { runId: 'healthy', workflow: { identity: 'dev-harness', path: workflowPath }, status: 'running', createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:02:00.000Z', workerLease: null, title: 'Healthy' },
    corrupt: { runId: 'corrupt', workflow: { identity: 'dev-harness', path: workflowPath }, status: 'running', createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:01:00.000Z', workerLease: null, title: 'Corrupt' },
  };
  await writeFile(join(runsRoot, 'runs.json'), JSON.stringify({ schemaVersion: 1, topologyVersion: 'workflow-runs-v1', runs: entries }), { mode: 0o600 });
  for (const runId of Object.keys(entries)) await mkdir(join(runsRoot, runId, '.workflow-runner'), { recursive: true });
  await writeFile(join(runsRoot, 'healthy', 'baton.json'), JSON.stringify({ cursor: 'approval_gate', status: 'running', state: { artifacts: [], results: [] } }), { mode: 0o600 });
  await writeFile(join(runsRoot, 'healthy', 'history.md'), 'safe history', { mode: 0o600 });
  await writeFile(join(runsRoot, 'corrupt', 'baton.json'), '{not json', { mode: 0o600 });
  await writeFile(join(runsRoot, 'corrupt', 'history.md'), '', { mode: 0o600 });
  return runsRoot;
}

describe('RunsRootObserverReader', () => {
  test('isolates corrupt runs and rebuilds exclusively from durable state', async () => {
    const runsRoot = await fixture();
    const first = await new RunsRootObserverReader(runsRoot).listRuns();
    const second = await new RunsRootObserverReader(runsRoot).listRuns();
    expect(first).toEqual(second);
    expect(first.find((run) => run.runId === 'healthy')?.laneId).toBe('waiting_for_user');
    expect(first.find((run) => run.runId === 'corrupt')?.laneId).toBe('degraded');
  });

  test('treats whole-index corruption as snapshot failure, never empty success', async () => {
    const runsRoot = await fixture();
    await writeFile(join(runsRoot, 'runs.json'), '{not json', { mode: 0o600 });
    await expect(new RunsRootObserverReader(runsRoot).listRuns()).rejects.toThrow();
  });
});
