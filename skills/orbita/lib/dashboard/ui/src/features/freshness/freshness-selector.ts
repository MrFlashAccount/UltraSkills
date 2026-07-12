import type { ObserverFreshnessDTO } from '@dashboard-contracts';
import type { TransportState } from './use-dashboard-events';

export type FreshnessView = { unhealthy: boolean; label: string; detail: string };

type FreshnessSignals = {
  transport: TransportState;
  eventStale: boolean;
  httpFailed: boolean;
  now: number;
};

export function selectFreshness(freshness: ObserverFreshnessDTO, signals: FreshnessSignals): FreshnessView {
  const lastSuccessAt = freshness.lastSuccessfulRefreshAt ? Date.parse(freshness.lastSuccessfulRefreshAt) : null;
  const expired = lastSuccessAt === null || signals.now - lastSuccessAt >= freshness.staleAfterMs;
  const unhealthy = freshness.state === 'stale' || signals.eventStale || signals.transport !== 'connected' || signals.httpFailed || expired;
  if (!unhealthy) return { unhealthy: false, label: 'Live', detail: 'Observer and transport are healthy' };
  const lastGood = lastSuccessAt === null ? null : Math.max(0, Math.floor((signals.now - lastSuccessAt) / 1_000));
  const age = lastGood === null ? 'no successful snapshot' : `last update ${lastGood}s`;
  const detail = freshness.state === 'stale' || signals.eventStale || expired
    ? 'Observer data is stale'
    : signals.httpFailed ? 'Snapshot reconciliation failed' : 'Transport is reconnecting';
  return { unhealthy: true, label: `Reconnecting · ${age}`, detail };
}
