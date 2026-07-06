import type { DashboardEventPublisher } from '../../server/dashboard-event-publisher.mjs';
import type { RunsRootObserverReader } from '../../server/runs-root-observer-reader.mjs';

type DashboardRuntimeContext = {
  reader: RunsRootObserverReader;
  publisher: DashboardEventPublisher;
  errorMessage: (error: unknown) => string;
};

const contextKey = Symbol.for('orbita.dashboard.runtime');

function runtimeStore() {
  return globalThis as typeof globalThis & {
    [contextKey]?: DashboardRuntimeContext;
  };
}

export function setDashboardRuntimeContext(context: DashboardRuntimeContext) {
  runtimeStore()[contextKey] = context;
}

export function clearDashboardRuntimeContext() {
  delete runtimeStore()[contextKey];
}

export function dashboardRuntimeContext() {
  const context = runtimeStore()[contextKey];
  if (!context) throw new Error('dashboard runtime context is not initialized');
  return context;
}

export function dashboardJson(payload: unknown, init?: ResponseInit) {
  return Response.json(payload, {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });
}

export function dashboardErrorResponse(error: unknown, status = 500) {
  const { errorMessage } = dashboardRuntimeContext();
  return dashboardJson({ error: errorMessage(error) }, { status });
}
