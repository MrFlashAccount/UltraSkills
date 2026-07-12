import {
  DASHBOARD_LANE_ORDER,
  type DashboardLaneId,
  type RunSummaryDTO,
} from '@dashboard-contracts';

export type BoardFilters = { q: string; workflow?: string; lane?: DashboardLaneId };

export const LANE_LABELS: Record<DashboardLaneId, string> = {
  waiting_for_user: 'Waiting for user',
  worker_running: 'Worker running',
  needs_help: 'Needs help',
  degraded: 'Degraded',
  done: 'Done',
};

export function filterRuns(runs: readonly RunSummaryDTO[], filters: BoardFilters): RunSummaryDTO[] {
  const query = filters.q.trim().toLocaleLowerCase();
  return runs.filter((run) => {
    if (filters.workflow && run.workflow !== filters.workflow) return false;
    if (filters.lane && run.laneId !== filters.lane) return false;
    if (!query) return true;
    return [run.title.value, run.workflow, run.currentStep, run.reason?.value, run.runId].some(
      (value) => value?.toLocaleLowerCase().includes(query),
    );
  });
}

export function groupRuns(runs: readonly RunSummaryDTO[]) {
  return Object.fromEntries(
    DASHBOARD_LANE_ORDER.map((lane) => [lane, runs.filter((run) => run.laneId === lane)]),
  ) as Record<DashboardLaneId, RunSummaryDTO[]>;
}

export function workflowsFor(runs: readonly RunSummaryDTO[]): string[] {
  return [...new Set(runs.map((run) => run.workflow))].toSorted((a, b) => a.localeCompare(b));
}
