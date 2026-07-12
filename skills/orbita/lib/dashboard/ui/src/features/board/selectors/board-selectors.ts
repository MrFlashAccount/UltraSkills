import {
  DASHBOARD_LANE_ORDER,
  type DashboardLaneId,
  type RunSummaryDTO,
} from "@dashboard-contracts";

export type BoardFilters = {
  lane?: DashboardLaneId | undefined;
  q: string;
  workflow?: string | undefined;
};

export const LANE_LABELS: Record<DashboardLaneId, string> = {
  degraded: "Degraded",
  done: "Done",
  needs_help: "Needs help",
  waiting_for_user: "Waiting for user",
  worker_running: "Worker running",
};

export function filterRuns(
  runs: ReadonlyArray<RunSummaryDTO>,
  filters: BoardFilters,
): Array<RunSummaryDTO> {
  const query = filters.q.trim().toLocaleLowerCase();
  return runs.filter((run) => {
    if (filters.workflow && run.workflow !== filters.workflow) {
      return false;
    }
    if (filters.lane && run.laneId !== filters.lane) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [run.title.value, run.workflow, run.currentStep, run.reason?.value, run.runId].some(
      (value) => value?.toLocaleLowerCase().includes(query),
    );
  });
}

export function groupRuns(runs: ReadonlyArray<RunSummaryDTO>) {
  return Object.fromEntries(
    DASHBOARD_LANE_ORDER.map((lane) => [lane, runs.filter((run) => run.laneId === lane)]),
  ) as Record<DashboardLaneId, Array<RunSummaryDTO>>;
}

export function workflowsFor(runs: ReadonlyArray<RunSummaryDTO>): Array<string> {
  return [...new Set(runs.map((run) => run.workflow))].toSorted((a, b) => a.localeCompare(b));
}
