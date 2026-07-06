import { dashboardEventTypes } from './dashboardConstants';
import { normalizeDashboardSnapshot, normalizeRun } from './dashboardModel';
import type { DashboardClientEvent, DashboardModel, DashboardRun } from './dashboardTypes';

const endpoints = {
  list: '/api/runs',
  detail: (runId: string) => `/api/runs/${encodeURIComponent(runId)}`,
  events: '/api/events',
};

export async function fetchDashboardSnapshot(fetcher: typeof fetch = fetch): Promise<DashboardModel> {
  const response = await fetcher(endpoints.list, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`dashboard list failed: ${response.status}`);
  return normalizeDashboardSnapshot(await response.json());
}

export async function fetchDashboardRun(runId: string, fetcher: typeof fetch = fetch): Promise<DashboardRun> {
  const response = await fetcher(endpoints.detail(runId), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`dashboard detail failed: ${response.status}`);
  const detail = await response.json();
  return normalizeRun(detail?.run ?? detail);
}

export function subscribeDashboardEvents(onEvent: (event: DashboardClientEvent) => void): () => void {
  if (typeof window === 'undefined' || !('EventSource' in window)) return () => {};
  const source = new EventSource(endpoints.events);

  source.addEventListener(dashboardEventTypes.snapshot, () => onEvent({ type: 'snapshot' }));
  source.addEventListener(dashboardEventTypes.runUpdated, (event) => {
    const update = safeJson(event.data);
    const runId = typeof update?.runId === 'string' ? update.runId : '';
    if (runId) onEvent({ type: 'run_updated', runId });
  });
  source.addEventListener(dashboardEventTypes.error, (event) => {
    const update = safeJson(event.data);
    onEvent({ type: 'error', message: String(update?.error ?? update?.message ?? 'dashboard event failed') });
  });
  source.addEventListener('error', () => onEvent({ type: 'error', message: 'dashboard event stream unavailable' }));

  return () => source.close();
}

function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
