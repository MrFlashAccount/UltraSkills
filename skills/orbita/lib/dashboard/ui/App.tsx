import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Dashboard, DashboardError, DashboardLoading } from './Dashboard';
import { loadDashboardRun, loadDashboardSnapshot, subscribeDashboardEvents } from './api';
import { clearDrawerFocusIntent, focusIntentForRunSelection } from './interaction';
import type { DrawerFocusIntent } from './interaction';
import type { DashboardLoadState, DashboardSnapshot } from './types';

export function App(): ReactElement {
  const [loadState, setLoadState] = useState<DashboardLoadState>({ kind: 'loading' });
  const [lastSelectedRunId, setLastSelectedRunId] = useState<string | null>(null);
  const [drawerFocusIntent, setDrawerFocusIntent] = useState<DrawerFocusIntent>(null);

  const refresh = useCallback(async (runId?: string) => {
    try {
      if (runId) {
        const nextRun = await loadDashboardRun(runId);
        if (!nextRun) return;
        setLoadState((current) => current.kind === 'ready'
          ? { kind: 'ready', snapshot: { ...current.snapshot, runs: current.snapshot.runs.map((run) => run.id === runId ? nextRun : run) } }
          : current);
        return;
      }
      setLoadState({ kind: 'ready', snapshot: await loadDashboardSnapshot() });
    } catch (error) {
      setLoadState((current) => ({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        snapshot: current.kind === 'ready' ? current.snapshot : undefined,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeDashboardEvents(
    (runId) => {
      void refresh(runId);
    },
    (message) => {
      setLoadState((current) => ({
        kind: 'error',
        message,
        snapshot: current.kind === 'ready' ? current.snapshot : undefined,
      }));
    },
  ), [refresh]);

  if (loadState.kind === 'loading') return <DashboardLoading />;
  if (loadState.kind === 'error' && !loadState.snapshot) return <DashboardError message={loadState.message} />;

  const snapshot = loadState.kind === 'ready' ? loadState.snapshot : loadState.snapshot as DashboardSnapshot;

  return (
    <Dashboard
      snapshot={snapshot}
      drawerFocusIntent={drawerFocusIntent}
      errorMessage={loadState.kind === 'error' ? loadState.message : undefined}
      onSearchChange={(query) => setLoadState((current) => applySnapshot(current, { searchQuery: query }))}
      onSelectRun={(runId) => {
        setLastSelectedRunId(runId);
        setDrawerFocusIntent(focusIntentForRunSelection(runId));
        setLoadState((current) => applySnapshot(current, { selectedRunId: runId }));
        void refresh(runId);
      }}
      onCloseDrawer={() => {
        setDrawerFocusIntent(clearDrawerFocusIntent());
        setLoadState((current) => applySnapshot(current, { selectedRunId: null }));
        if (lastSelectedRunId) document.querySelector<HTMLElement>(`[data-run-id="${escapeCssIdentifier(lastSelectedRunId)}"]`)?.focus();
      }}
    />
  );
}

function applySnapshot(loadState: DashboardLoadState, patch: Partial<DashboardSnapshot>): DashboardLoadState {
  if (loadState.kind === 'loading') return loadState;
  const snapshot = loadState.kind === 'ready' ? loadState.snapshot : loadState.snapshot;
  if (!snapshot) return loadState;
  const next = { ...snapshot, ...patch };
  return loadState.kind === 'ready' ? { kind: 'ready', snapshot: next } : { ...loadState, snapshot: next };
}

function escapeCssIdentifier(value: string): string {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replaceAll('"', '\\"');
}
