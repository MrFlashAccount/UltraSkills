import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connectDashboardEvents, fetchDashboardRun, fetchDashboardRuns } from '../api/dashboardClient';
import { normalizeRun, normalizeRuns } from '../view-models/normalizeRuns';
import type { DashboardRun, DashboardRunDto, DashboardSnapshot } from '../types/dashboard';

type DashboardRunsState = {
  error: string | undefined;
  freshnessLabel: string;
  loading: boolean;
  rootLabel: string | undefined;
  runs: DashboardRun[];
};

export function useDashboardRuns(initialSnapshot?: DashboardSnapshot): DashboardRunsState {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(initialSnapshot ?? {});
  const [runs, setRuns] = useState<DashboardRun[]>(() => normalizeRuns(initialSnapshot?.runs));
  const [loading, setLoading] = useState(!initialSnapshot);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | undefined>(undefined);

  const loadRuns = useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setLoading(true);
    try {
      const nextSnapshot = await fetchDashboardRuns(abort.signal);
      setSnapshot(nextSnapshot);
      setRuns(normalizeRuns(nextSnapshot.runs));
      setError(undefined);
    } catch (loadError) {
      if (!abort.signal.aborted) setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }, []);

  const loadRunDetail = useCallback(async (runId: string) => {
    const nextRun = await fetchDashboardRun(runId);
    if (!nextRun) return;
    setRuns((current) => replaceRun(current, nextRun));
  }, []);

  useEffect(() => {
    if (!initialSnapshot) void loadRuns();
    return () => abortRef.current?.abort();
  }, [initialSnapshot, loadRuns]);

  useEffect(() => connectDashboardEvents(
    (runId) => {
      if (runId) void loadRunDetail(runId).catch((eventError) => setError(eventError.message));
      else void loadRuns();
    },
    setError,
  ), [loadRunDetail, loadRuns]);

  return useMemo(() => ({
    error,
    freshnessLabel: snapshot.generatedAt ? new Date(snapshot.generatedAt).toLocaleTimeString() : 'freshness unknown',
    loading,
    rootLabel: snapshot.rootLabel,
    runs,
  }), [error, loading, runs, snapshot.generatedAt, snapshot.rootLabel]);
}

function replaceRun(current: DashboardRun[], runDto: DashboardRunDto): DashboardRun[] {
  const nextRun = normalizeRun(runDto);
  return current.map((run) => (run.id === nextRun.id ? { ...run, ...nextRun } : run));
}
