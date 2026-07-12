import { describe, expect, test } from 'bun:test';
import { DashboardReadModel, ObserverUnavailableError } from './dashboard-read-model.server';
import type { RunSummaryDTO } from '../contracts/browser';

const run: RunSummaryDTO = {
  runId: 'run-1', title: { sourceClass: 'run_title', value: 'Run one', policyVersion: '1' }, workflow: 'dev-harness', laneId: 'worker_running',
  cursor: { kind: 'single', step: 'implementation' }, occupancy: { state: 'unclaimed' },
};

describe('DashboardReadModel', () => {
  test('retains last-good cards and truthfully transitions stale then recovered', async () => {
    let timestamp = 0;
    let failure: Error | undefined;
    const reader = { listRuns: async () => { if (failure) throw failure; return [run]; }, getRun: async () => undefined };
    const model = new DashboardReadModel(reader, { watchEnabled: false, now: () => new Date(Date.UTC(2026, 6, 12, 0, 0, timestamp++)) });
    const events: string[] = [];
    model.subscribe((event) => events.push(event.reason));
    await model.refresh();
    const fresh = await model.ensureSnapshot();
    failure = new Error('/private/runs/run-1 failed with secret');
    await model.refresh();
    const stale = await model.ensureSnapshot();
    await model.refresh();
    const staleAgain = await model.ensureSnapshot();
    failure = undefined;
    await model.refresh();
    const recovered = await model.ensureSnapshot();
    expect(stale.runs).toEqual(fresh.runs);
    expect(stale.freshness.state).toBe('stale');
    expect(staleAgain.freshness.staleSince).toBe(stale.freshness.staleSince);
    expect(staleAgain.freshness.failureCode).toBe('observer_refresh_failed');
    expect(staleAgain.freshness.observerRevision).not.toBe(stale.freshness.observerRevision);
    expect(recovered.freshness.state).toBe('fresh');
    expect(events).toEqual(['snapshot_changed', 'observer_stale', 'observer_stale', 'observer_recovered']);
    expect(stale.snapshotVersion).toBe(fresh.snapshotVersion);
    expect(BigInt(stale.freshness.observerRevision)).toBeGreaterThan(BigInt(fresh.freshness.observerRevision));
    await model.close();
    await model.close();
  });

  test('bounds refresh concurrency to one active and one queued', async () => {
    let active = 0;
    let maximum = 0;
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const reader = {
      listRuns: async () => { calls++; active++; maximum = Math.max(maximum, active); if (calls === 1) await gate; active--; return [run]; },
      getRun: async () => undefined,
    };
    const model = new DashboardReadModel(reader, { watchEnabled: false });
    const first = model.refresh();
    model.refresh(); model.refresh(); model.refresh();
    release();
    await first;
    expect(maximum).toBe(1);
    expect(calls).toBe(2);
    await model.close();
  });

  test('fails first build with a bounded observer error', async () => {
    const model = new DashboardReadModel({ listRuns: async () => { throw new Error('/secret/path'); }, getRun: async () => undefined }, { watchEnabled: false });
    await expect(model.ensureSnapshot()).rejects.toBeInstanceOf(ObserverUnavailableError);
    await model.close();
  });

  test('coalesces a 100-change burst to at most one invalidation per 100ms window', async () => {
    let version = 0;
    const reader = {
      listRuns: async () => [{ ...run, title: { sourceClass: 'run_title' as const, value: `Run ${version++}`, policyVersion: '1' as const } }],
      getRun: async () => undefined,
    };
    const model = new DashboardReadModel(reader, { watchEnabled: false, invalidationCoalesceMs: 100 });
    const events: string[] = [];
    model.subscribe((event) => events.push(event.reason));
    for (let index = 0; index < 100; index++) await model.refresh();
    await new Promise((resolve) => setTimeout(resolve, 110));
    expect(events).toEqual(['snapshot_changed', 'snapshot_changed']);
    await model.close();
  });

  test('expires freshness at the configured deadline while a refresh remains in flight', async () => {
    let block = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const reader = {
      listRuns: async () => { if (block) await gate; return [run]; },
      getRun: async () => undefined,
    };
    const model = new DashboardReadModel(reader, { watchEnabled: false, staleAfterMs: 1_000 });
    await model.refresh();
    block = true;
    const pending = model.refresh();
    await new Promise((resolve) => setTimeout(resolve, 1_050));
    const stale = await model.ensureSnapshot();
    expect(stale.freshness.state).toBe('stale');
    expect(stale.freshness.failureCode).toBe('observer_refresh_timeout');
    expect(stale.freshness.staleAfterMs).toBe(1_000);
    release();
    await pending;
    expect((await model.ensureSnapshot()).freshness.state).toBe('fresh');
    await model.close();
  });

  test('close aborts one active refresh and drops the queued refresh', async () => {
    let calls = 0;
    let aborted = false;
    const reader = {
      listRuns: async (signal?: AbortSignal) => {
        calls++;
        await new Promise<void>((resolve, reject) => signal?.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true }));
        return [run];
      },
      getRun: async () => undefined,
    };
    const model = new DashboardReadModel(reader, { watchEnabled: false });
    void model.refresh();
    model.refresh();
    await model.close();
    expect(aborted).toBe(true);
    expect(calls).toBe(1);
  });
});
