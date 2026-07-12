import type { DashboardLaneId, RunSummaryDTO } from '@dashboard-contracts';
import { useMemo, useRef } from 'react';
import { filterRuns, groupRuns, workflowsFor, type BoardFilters } from '../selectors/board-selectors';

export function useBoardModel(runs: readonly RunSummaryDTO[], filters: BoardFilters) {
  const previousLanes = useRef<Record<DashboardLaneId, RunSummaryDTO[]> | undefined>(undefined);
  return useMemo(() => {
    const filtered = filterRuns(runs, filters);
    const nextLanes = groupRuns(filtered);
    const lanes = Object.fromEntries(Object.entries(nextLanes).map(([lane, values]) => {
      const previous = previousLanes.current?.[lane as DashboardLaneId];
      return [lane, previous && sameRuns(previous, values) ? previous : values];
    })) as Record<DashboardLaneId, RunSummaryDTO[]>;
    previousLanes.current = lanes;
    const counts = Object.fromEntries(Object.entries(lanes).map(([lane, values]) => [lane, values.length])) as Record<DashboardLaneId, number>;
    return { filtered, lanes, counts, workflows: workflowsFor(runs), total: runs.length };
  }, [runs, filters]);
}

function sameRuns(previous: readonly RunSummaryDTO[], next: readonly RunSummaryDTO[]) {
  return previous.length === next.length && previous.every((run, index) => {
    const candidate = next[index];
    return run.runId === candidate.runId && run.title.value === candidate.title.value && run.reason?.value === candidate.reason?.value && run.workflow === candidate.workflow && run.laneId === candidate.laneId && run.status === candidate.status && run.createdAt === candidate.createdAt && run.updatedAt === candidate.updatedAt && run.currentStep === candidate.currentStep && run.cursor.kind === candidate.cursor.kind && (run.cursor.kind !== 'single' || candidate.cursor.kind === 'single' && run.cursor.step === candidate.cursor.step) && run.occupancy.state === candidate.occupancy.state;
  });
}
