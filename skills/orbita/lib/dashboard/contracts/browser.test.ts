import { describe, expect, test } from 'bun:test';
import { DASHBOARD_LANE_ORDER, InvalidationEventSchema, RunSummarySchema, SnapshotEnvelopeSchema } from './browser';

const summary = {
  runId: 'run-1', title: { sourceClass: 'run_title', value: 'Safe run', policyVersion: '1' }, workflow: 'dev-harness', laneId: 'worker_running',
  cursor: { kind: 'single', step: 'implementation' }, occupancy: { state: 'unclaimed' },
} as const;

describe('dashboard browser contracts', () => {
  test('fixes lane order and rejects unknown DTO fields', () => {
    expect(DASHBOARD_LANE_ORDER).toEqual(['waiting_for_user', 'worker_running', 'needs_help', 'degraded', 'done']);
    expect(RunSummarySchema.parse(summary)).toEqual(summary);
    expect(() => RunSummarySchema.parse({ ...summary, tokenHash: 'secret' })).toThrow();
  });

  test('strictly validates snapshot freshness and closed invalidation reasons', () => {
    const snapshot = {
      schemaVersion: '1', snapshotVersion: '1', generatedAt: '2026-07-12T00:00:00.000Z',
      freshness: { state: 'fresh', observerRevision: '1', lastRefreshAttemptAt: '2026-07-12T00:00:00.000Z', lastSuccessfulRefreshAt: '2026-07-12T00:00:00.000Z', staleSince: null, staleAfterMs: 10_000, retryAt: null },
      runs: [summary],
    };
    expect(SnapshotEnvelopeSchema.parse(snapshot)).toEqual(snapshot);
    expect(() => SnapshotEnvelopeSchema.parse({ ...snapshot, freshness: { ...snapshot.freshness, rawError: '/private/path' } })).toThrow();
    expect(() => InvalidationEventSchema.parse({ schemaVersion: '1', type: 'invalidation', reason: 'snapshot', changeId: '1', emittedAt: '2026-07-12T00:00:00.000Z' })).toThrow();
  });

  test('keeps representative 1,000-run snapshot below the transport budget', () => {
    const runs = Array.from({ length: 1_000 }, (_, index) => ({
      ...summary,
      runId: `run-${index}`,
      title: { sourceClass: 'run_title' as const, value: `Run ${index} ${'x'.repeat(100)}`, policyVersion: '1' as const },
      laneId: index < 900 ? 'waiting_for_user' as const : 'done' as const,
    }));
    const envelope = SnapshotEnvelopeSchema.parse({
      schemaVersion: '1', snapshotVersion: '1', generatedAt: '2026-07-12T00:00:00.000Z',
      freshness: { state: 'fresh', observerRevision: '1', lastRefreshAttemptAt: '2026-07-12T00:00:00.000Z', lastSuccessfulRefreshAt: '2026-07-12T00:00:00.000Z', staleSince: null, staleAfterMs: 10_000, retryAt: null },
      runs,
    });
    expect(new TextEncoder().encode(JSON.stringify(envelope)).byteLength).toBeLessThanOrEqual(1.5 * 1024 * 1024);
  });
});
