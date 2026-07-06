import { dashboardEndpoints } from '../constants/dashboard';
import type { DashboardRunDto, DashboardSnapshot } from '../types/dashboard';

export async function fetchDashboardRuns(signal?: AbortSignal): Promise<DashboardSnapshot> {
  const response = await fetch(dashboardEndpoints.list, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`dashboard list failed: ${response.status}`);
  const snapshot: unknown = await response.json();
  return snapshot && typeof snapshot === 'object' ? snapshot as DashboardSnapshot : { runs: [] };
}

export async function fetchDashboardRun(runId: string, signal?: AbortSignal): Promise<DashboardRunDto | undefined> {
  const response = await fetch(dashboardEndpoints.detail(runId), {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`dashboard detail failed: ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') return undefined;
  return 'run' in payload ? (payload as { run?: DashboardRunDto }).run : payload as DashboardRunDto;
}

export function parseRunUpdatedEvent(event: MessageEvent): string | undefined {
  try {
    const update = JSON.parse(event.data) as { runId?: unknown };
    return typeof update.runId === 'string' ? update.runId : undefined;
  } catch {
    return undefined;
  }
}

export function createDashboardEventHandlers(onChange: (runId?: string) => void, onError: (message: string) => void) {
  return {
    onSnapshot: () => onChange(),
    onRunUpdated: (event: MessageEvent) => {
      const runId = parseRunUpdatedEvent(event);
      if (runId) onChange(runId);
      else onError('dashboard event payload degraded');
    },
    onStreamError: () => onError('dashboard event stream degraded'),
  };
}

export function connectDashboardEvents(onChange: (runId?: string) => void, onError: (message: string) => void): () => void {
  if (!('EventSource' in window)) return () => undefined;
  const source = new EventSource(dashboardEndpoints.events);
  const handlers = createDashboardEventHandlers(onChange, onError);
  source.addEventListener('dashboard.snapshot', handlers.onSnapshot);
  source.addEventListener('dashboard.run_updated', (event) => handlers.onRunUpdated(event as MessageEvent));
  source.addEventListener('error', handlers.onStreamError);
  return () => source.close();
}
