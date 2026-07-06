import { useCallback, useMemo, useState } from 'react';
import type { DashboardRun } from '../types/dashboard';

export function useDashboardSelection(runs: DashboardRun[]) {
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [lastSelectedRunId, setLastSelectedRunId] = useState<string | undefined>();

  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId), [runs, selectedRunId]);

  const selectRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setLastSelectedRunId(runId);
  }, []);

  const closeSelection = useCallback(() => {
    setSelectedRunId(undefined);
  }, []);

  return {
    closeSelection,
    lastSelectedRunId,
    selectRun,
    selectedRun,
    selectedRunId,
  };
}
