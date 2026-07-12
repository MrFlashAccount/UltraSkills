import { describe, expect, test } from 'bun:test';
import type { RunSummaryDTO } from '../../../../dashboard/contracts/browser';
import { createDashboardComposition } from './dashboard-composition.server';
import { handleDetailRequest, handleEventsRequest, handleSnapshotRequest } from './dashboard-http.server';

const timestamp = '2026-07-12T00:00:00.000Z';
const run: RunSummaryDTO = {
  runId: 'run-1',
  title: { sourceClass: 'run_title', value: 'Run', policyVersion: '1' },
  workflow: 'dev-harness',
  laneId: 'worker_running',
  cursor: { kind: 'none' },
  occupancy: { state: 'unclaimed' },
};
const snapshot = {
  schemaVersion: '1', snapshotVersion: '7', generatedAt: timestamp,
  freshness: { state: 'fresh', observerRevision: '9', lastRefreshAttemptAt: timestamp, lastSuccessfulRefreshAt: timestamp, staleSince: null, staleAfterMs: 10_000, retryAt: null },
  runs: [run],
} as const;

const config = { host: '127.0.0.1', port: 3000, heartbeatMs: 60_000 };

function request(path = '/api/dashboard/v1/runs', init: RequestInit = {}): Request {
  return new Request(`http://127.0.0.1:3000${path}`, {
    ...init,
    headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', ...init.headers },
  });
}

function composition() {
  const subscribers = new Set<(event: any) => void>();
  return {
    config,
    readModel: {
      ensureSnapshot: async () => snapshot,
      getDetail: async (runId: string) => runId === 'run-1' ? {
        ...run, schemaVersion: '1', facts: [], history: [], historyTruncated: false, artifacts: [], results: [], miniMap: { state: 'unavailable' },
      } : undefined,
      subscribe: (subscriber: (event: any) => void) => { subscribers.add(subscriber); return () => subscribers.delete(subscriber); },
    },
    async close() {}, subscribers,
  };
}

describe('dashboard v1 HTTP handlers', () => {
  test('serves conditional strict snapshot and bounded method errors', async () => {
    const fake = composition();
    const response = await handleSnapshotRequest(request(), fake as any);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"dashboard-v1-s7-o9"');
    const conditional = await handleSnapshotRequest(request(undefined, { headers: { 'if-none-match': '"dashboard-v1-s7-o9"' } }), fake as any);
    expect(conditional.status).toBe(304);
    const rejected = await handleSnapshotRequest(request(undefined, { method: 'POST' }), fake as any);
    expect(rejected.status).toBe(405);
  });

  test('enforces configured Host and same-origin authority', async () => {
    const fake = composition();
    const foreignHost = request(undefined, { headers: { host: 'evil.example', origin: 'http://evil.example' } });
    expect((await handleSnapshotRequest(foreignHost, fake as any)).status).toBe(403);
    const foreignOrigin = request(undefined, { headers: { host: '127.0.0.1:3000', origin: 'https://evil.example' } });
    expect((await handleSnapshotRequest(foreignOrigin, fake as any)).status).toBe(403);
    expect(handleEventsRequest(foreignOrigin, fake as any).status).toBe(403);
  });

  test('validates ids and returns closed detail errors', async () => {
    const fake = composition();
    expect((await handleDetailRequest(request('/'), '../secret', fake as any)).status).toBe(400);
    expect((await handleDetailRequest(request('/'), 'missing', fake as any)).status).toBe(404);
    const detail = await handleDetailRequest(request('/'), 'run-1', fake as any);
    expect(detail.status).toBe(200);
    expect(detail.headers.get('etag')).toBe('"dashboard-v1-detail-s7-o9-run-1"');
  });

  test('streams the versioned invalidation record and unsubscribes on cancel', async () => {
    const fake = composition();
    const response = handleEventsRequest(request('/api/dashboard/v1/events'), fake as any);
    const reader = response.body!.getReader();
    await reader.read();
    const event = { schemaVersion: '1', type: 'invalidation', reason: 'observer_stale', changeId: '10', emittedAt: timestamp };
    for (const subscriber of fake.subscribers) subscriber(event);
    const frame = new TextDecoder().decode((await reader.read()).value);
    expect(frame).toBe(`id: 10\nevent: invalidation\ndata: ${JSON.stringify(event)}\n\n`);
    expect(frame).not.toContain('"runs"');
    await reader.cancel();
    expect(fake.subscribers.size).toBe(0);
  });

  test('keeps connected SSE truthful through stale, repeated stale, conditional GET, and recovery', async () => {
    let failure = false;
    const readerSource = {
      listRuns: async () => { if (failure) throw new Error('/private/root secret'); return [run]; },
      getRun: async () => undefined,
    };
    const real = createDashboardComposition({ runsRoot: process.cwd(), host: '127.0.0.1', port: 3000, pollMs: 60_000, heartbeatMs: 60_000, staleMs: 10_000, coalesceMs: 10 }, readerSource);
    const model = real.readModel;
    await model.refresh();
    let activeSubscriptions = 0;
    const subscribe = model.subscribe.bind(model);
    (model as any).subscribe = (subscriber: any) => {
      activeSubscriptions++;
      const unsubscribe = subscribe(subscriber);
      return () => { activeSubscriptions--; unsubscribe(); };
    };
    const stream = handleEventsRequest(request('/api/dashboard/v1/events'), real as any);
    const streamReader = stream.body!.getReader();
    await streamReader.read();
    const first = await handleSnapshotRequest(request(), real as any);
    const firstEtag = first.headers.get('etag')!;
    const firstBody = await first.json();

    failure = true;
    await model.refresh();
    const staleEvent = new TextDecoder().decode((await streamReader.read()).value);
    expect(staleEvent).toContain('"reason":"observer_stale"');
    const staleResponse = await handleSnapshotRequest(request(undefined, { headers: { 'if-none-match': firstEtag } }), real as any);
    expect(staleResponse.status).toBe(200);
    const staleEtag = staleResponse.headers.get('etag')!;
    const staleBody = await staleResponse.json();
    expect(staleBody.runs).toEqual(firstBody.runs);
    expect(staleBody.snapshotVersion).toBe(firstBody.snapshotVersion);
    expect(staleBody.freshness.state).toBe('stale');
    expect(staleEtag).not.toBe(firstEtag);

    await model.refresh();
    const repeatedEvent = new TextDecoder().decode((await streamReader.read()).value);
    expect(repeatedEvent).toContain('"reason":"observer_stale"');
    const repeated = await handleSnapshotRequest(request(undefined, { headers: { 'if-none-match': staleEtag } }), real as any);
    expect(repeated.status).toBe(200);
    expect(repeated.headers.get('etag')).not.toBe(staleEtag);

    failure = false;
    await model.refresh();
    const recoveredEvent = new TextDecoder().decode((await streamReader.read()).value);
    expect(recoveredEvent).toContain('"reason":"observer_recovered"');
    expect((await (await handleSnapshotRequest(request(), real as any)).json()).freshness.state).toBe('fresh');
    await streamReader.cancel();
    expect(activeSubscriptions).toBe(0);
    await real.close();
  });

  test('streams the real read model through Bun HTTP and releases the client on disconnect', async () => {
    let failure = false;
    const source = {
      listRuns: async () => { if (failure) throw new Error('refresh failed'); return [run]; },
      getRun: async () => undefined,
    };
    const real = createDashboardComposition({ runsRoot: process.cwd(), host: '127.0.0.1', port: 0, pollMs: 60_000, heartbeatMs: 60_000, staleMs: 10_000, coalesceMs: 10 }, source);
    await real.readModel.refresh();
    let activeSubscriptions = 0;
    const subscribe = real.readModel.subscribe.bind(real.readModel);
    (real.readModel as any).subscribe = (subscriber: any) => {
      activeSubscriptions++;
      const unsubscribe = subscribe(subscriber);
      return () => { activeSubscriptions--; unsubscribe(); };
    };
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: (incoming) => new URL(incoming.url).pathname.endsWith('/events')
        ? handleEventsRequest(incoming, real as any)
        : handleSnapshotRequest(incoming, real as any),
    });
    const controller = new AbortController();
    try {
      const base = `http://127.0.0.1:${server.port}/api/dashboard/v1`;
      expect((await fetch(`${base}/runs`)).status).toBe(200);
      const response = await fetch(`${base}/events`, { signal: controller.signal });
      const body = response.body!.getReader();
      expect(new TextDecoder().decode((await body.read()).value)).toContain(': connected');
      failure = true;
      await real.readModel.refresh();
      expect(new TextDecoder().decode((await body.read()).value)).toContain('"reason":"observer_stale"');
      controller.abort();
      await body.cancel().catch(() => {});
    } finally {
      await server.stop(true);
      await real.close();
    }
    expect(activeSubscriptions).toBe(0);
  });
});
