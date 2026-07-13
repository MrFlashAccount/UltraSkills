import type { DashboardLaneId, RunSummaryDTO } from "@dashboard-contracts";
import {
  filterRuns,
  groupRuns,
  workflowsFor,
  type BoardFilters,
} from "../selectors/board-selectors";

export function useBoardModel(runs: ReadonlyArray<RunSummaryDTO>, filters: BoardFilters) {
  const filtered = filterRuns(runs, filters);
  const lanes = groupRuns(filtered);
  const counts = Object.fromEntries(
    Object.entries(lanes).map(([lane, values]) => [lane, values.length]),
  ) as Record<DashboardLaneId, number>;
  return { counts, filtered, lanes, total: runs.length, workflows: workflowsFor(runs) };
}
