import type { DashboardLaneId, RunSummaryDTO } from '@dashboard-contracts';
import { useRef } from 'react';

type Position = { lane: DashboardLaneId; ordinal: number };

/** Preserves same-lane positions; new and reclassified runs enter at the lane head. */
export function useStableLaneOrder(runs: readonly RunSummaryDTO[], reconciliation: number) {
  const state = useRef<{ reconciliation: number; next: number; positions: Map<string, Position> }>({ reconciliation, next: 0, positions: new Map() });
  if (state.current.reconciliation !== reconciliation) state.current = { reconciliation, next: 0, positions: new Map() };
  if (state.current.positions.size === 0) {
    runs.forEach((run, index) => state.current.positions.set(run.runId, { lane: run.laneId, ordinal: runs.length - index }));
    state.current.next = runs.length;
  }
  const activeIds = new Set(runs.map((run) => run.runId));
  for (const runId of state.current.positions.keys()) if (!activeIds.has(runId)) state.current.positions.delete(runId);
  for (const run of runs) {
    const previous = state.current.positions.get(run.runId);
    if (!previous || previous.lane !== run.laneId) state.current.positions.set(run.runId, { lane: run.laneId, ordinal: ++state.current.next });
  }
  return runs.toSorted((a, b) => state.current.positions.get(b.runId)!.ordinal - state.current.positions.get(a.runId)!.ordinal);
}
