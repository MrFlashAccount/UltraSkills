import { describe, expect, it } from 'vitest';
import { selectFreshness } from './freshness-selector';

const fresh = { state: 'fresh' as const, observerRevision: '5', lastRefreshAttemptAt: '2026-07-12T12:00:00.000Z', lastSuccessfulRefreshAt: '2026-07-12T12:00:00.000Z', staleSince: null, staleAfterMs: 10_000, retryAt: null };
const signals = { transport: 'connected' as const, eventStale: false, httpFailed: false, now: Date.parse('2026-07-12T12:00:05.000Z') };

describe('freshness selector', () => {
  it('reports healthy only while observer, HTTP, transport, and age agree', () => {
    expect(selectFreshness(fresh, signals)).toMatchObject({ unhealthy: false, label: 'Live' });
    expect(selectFreshness(fresh, { ...signals, httpFailed: true })).toMatchObject({ unhealthy: true, detail: 'Snapshot reconciliation failed' });
    expect(selectFreshness(fresh, { ...signals, transport: 'disconnected' })).toMatchObject({ unhealthy: true, detail: 'Transport is reconnecting' });
  });

  it('expires Live at the authoritative stale window even with connected transport', () => {
    const result = selectFreshness(fresh, { ...signals, now: Date.parse('2026-07-12T12:00:10.000Z') });
    expect(result).toMatchObject({ unhealthy: true, detail: 'Observer data is stale' });
    expect(result.label).toContain('last update 10s');
  });
});
