import { toDashboardSnapshot } from './contracts';
import type { DashboardRun, DashboardSnapshot } from './types';

const endpoints = {
  list: '/api/runs',
  detail: (runId: string) => `/api/runs/${encodeURIComponent(runId)}`,
  events: '/api/events',
} as const;

export async function loadDashboardSnapshot(fetcher: typeof fetch = fetch): Promise<DashboardSnapshot> {
  const response = await fetcher(endpoints.list, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`dashboard list failed: ${response.status}`);
  return toDashboardSnapshot(await response.json());
}

export async function loadDashboardRun(runId: string, fetcher: typeof fetch = fetch): Promise<DashboardRun | null> {
  const response = await fetcher(endpoints.detail(runId), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`dashboard detail failed: ${response.status}`);
  const payload = await response.json();
  const snapshot = toDashboardSnapshot({ runs: [readRunPayload(payload)] });
  return snapshot.runs[0] ?? null;
}

export function subscribeDashboardEvents(onRefresh: (runId?: string) => void, onError: (message: string) => void): () => void {
  if (!('EventSource' in window)) return () => {};
  const source = new EventSource(endpoints.events);
  source.addEventListener('dashboard.snapshot', () => onRefresh());
  source.addEventListener('dashboard.run_updated', (event) => {
    const runId = readRunIdFromEvent(event);
    if (runId) onRefresh(runId);
  });
  source.addEventListener('dashboard.error', (event) => {
    onError(readErrorMessage(event));
  });
  source.onerror = () => onError('dashboard event stream interrupted');
  return () => source.close();
}

function readRunPayload(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && 'run' in value) {
    return (value as { run: unknown }).run;
  }
  return value;
}

function readRunIdFromEvent(event: Event): string | undefined {
  const message = event as MessageEvent<string>;
  try {
    const parsed = JSON.parse(message.data) as unknown;
    if (parsed !== null && typeof parsed === 'object' && typeof (parsed as { runId?: unknown }).runId === 'string') {
      return (parsed as { runId: string }).runId;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function readErrorMessage(event: Event): string {
  const message = event as MessageEvent<string>;
  try {
    const parsed = JSON.parse(message.data) as unknown;
    if (parsed !== null && typeof parsed === 'object' && typeof (parsed as { message?: unknown }).message === 'string') {
      return (parsed as { message: string }).message;
    }
  } catch {
    return 'dashboard event stream failed';
  }
  return 'dashboard event stream failed';
}
