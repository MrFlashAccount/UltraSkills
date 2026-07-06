import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { KeyboardEvent } from 'react';
import { fetchDashboardRun, fetchDashboardSnapshot, subscribeDashboardEvents } from './dashboardClient';
import { createRunUpdateQueue } from './dashboardEventQueue';
import { buildDashboardViewModel, mergeRunUpdate } from './dashboardModel';
import type { DashboardModel, DashboardRun } from './dashboardTypes';
import { DashboardBoard } from './components/DashboardBoard';
import { DashboardTopbar } from './components/DashboardTopbar';
import { DegradedBanner, EmptyState, ErrorState, LoadingState } from './components/DashboardStates';
import styles from './DashboardApp.module.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; model: DashboardModel }
  | { status: 'error'; message: string };

export function DashboardApp() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedCardRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  const refreshSnapshot = useCallback(async () => {
    const model = await fetchDashboardSnapshot();
    setDegradedMessage(null);
    setLoadState({ status: 'ready', model });
    setSelectedRunId((current) => current ?? model.runs[0]?.id ?? null);
  }, []);

  useEffect(() => {
    refreshSnapshot().catch((error) => setLoadState({ status: 'error', message: errorMessage(error) }));
  }, [refreshSnapshot]);

  const applyRunUpdates = useCallback((runs: DashboardRun[]) => {
    setLoadState((current) => {
      if (current.status !== 'ready') return current;
      const mergedRuns = runs.reduce(mergeRunUpdate, current.model.runs);
      return { status: 'ready', model: { ...current.model, runs: mergedRuns } };
    });
  }, []);

  useEffect(() => {
    const queue = createRunUpdateQueue({
      loadRun: fetchDashboardRun,
      applyRuns: applyRunUpdates,
      onError: (error) => {
        const message = `dashboard update failed: ${errorMessage(error)}`;
        setDegradedMessage(message);
        refreshSnapshot().catch((refreshError) => {
          setDegradedMessage(`${message}; snapshot refresh failed: ${errorMessage(refreshError)}`);
        });
      },
    });
    const unsubscribe = subscribeDashboardEvents((event) => {
      if (event.type === 'snapshot') {
        refreshSnapshot().catch((error) => setLoadState({ status: 'error', message: errorMessage(error) }));
        return;
      }
      if (event.type === 'run_updated') {
        queue.enqueue(event.runId);
        return;
      }
      setDegradedMessage(event.message);
      setLoadState((current) => current.status === 'ready' ? current : { status: 'error', message: event.message });
    });
    return () => {
      unsubscribe();
      queue.dispose();
    };
  }, [applyRunUpdates, refreshSnapshot]);

  useEffect(() => {
    if (!selectedRunId) return;
    requestAnimationFrame(() => drawerRef.current?.focus());
  }, [selectedRunId]);

  const viewModel = useMemo(() => (
    loadState.status === 'ready'
      ? buildDashboardViewModel(loadState.model, query, selectedRunId)
      : null
  ), [loadState, query, selectedRunId]);

  const selectRun = useCallback((runId: string, card: HTMLElement | null) => {
    selectedCardRef.current = card;
    startTransition(() => setSelectedRunId(runId));
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedRunId(null);
    requestAnimationFrame(() => selectedCardRef.current?.focus());
  }, []);

  const handleShellKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !selectedRunId) return;
    event.preventDefault();
    closeDrawer();
  }, [closeDrawer, selectedRunId]);

  if (loadState.status === 'loading') return <LoadingState />;
  if (loadState.status === 'error') return <ErrorState message={loadState.message} onRetry={refreshSnapshot} />;
  if (!viewModel) return <EmptyState message="No dashboard model available" />;

  return (
    <main className={styles.dashboard} data-dashboard-runtime="tanstack-start" data-read-only="true" aria-busy={isPending} onKeyDown={handleShellKeyDown}>
      <DashboardTopbar
        rootLabel={loadState.model.rootLabel}
        freshnessLabel={loadState.model.freshnessLabel}
        runCount={viewModel.visibleRuns.length}
        query={query}
        onQueryChange={setQuery}
      />
      {degradedMessage ? <DegradedBanner message={degradedMessage} onRefresh={refreshSnapshot} /> : null}
      <DashboardBoard viewModel={viewModel} onSelectRun={selectRun} onCloseDrawer={closeDrawer} drawerRef={drawerRef} />
    </main>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
