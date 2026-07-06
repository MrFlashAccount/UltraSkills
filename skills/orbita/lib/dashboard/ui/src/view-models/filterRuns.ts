import type { DashboardRun } from '../types/dashboard';

export function filterRuns(runs: DashboardRun[], searchQuery: string): DashboardRun[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return runs;
  return runs.filter((run) => [
    run.id,
    run.title,
    run.summary,
    run.workflowName,
    run.stepId,
    run.statusLabel,
  ].some((value) => String(value ?? '').toLowerCase().includes(query)));
}

export function countsByLane(runs: DashboardRun[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const run of runs) counts.set(run.laneId, (counts.get(run.laneId) ?? 0) + 1);
  return counts;
}
