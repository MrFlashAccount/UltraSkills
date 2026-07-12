import type { DashboardLaneId, RunSummaryDTO } from '@dashboard-contracts';
import { useEffect, useMemo, useRef } from 'react';

type EnsureVisible = () => void;

export function useRovingRunFocus(runs: readonly RunSummaryDTO[]) {
  const current = useRef<string | undefined>(undefined);
  const elements = useRef(new Map<string, HTMLButtonElement>());
  const ensureVisible = useRef(new Map<string, EnsureVisible>());
  const laneHeaders = useRef(new Map<DashboardLaneId, HTMLElement>());
  const lastLanes = useRef(new Map<string, DashboardLaneId>());
  const runsRef = useRef(runs);
  runsRef.current = runs;

  useEffect(() => {
    const activeIds = new Set(runs.map((run) => run.runId));
    for (const runId of elements.current.keys())
      if (!activeIds.has(runId)) elements.current.delete(runId);
    for (const runId of ensureVisible.current.keys())
      if (!activeIds.has(runId)) ensureVisible.current.delete(runId);
    if (current.current && !runs.some((run) => run.runId === current.current)) {
      const lane = lastLanes.current.get(current.current);
      current.current = undefined;
      if (lane && document.activeElement === document.body) laneHeaders.current.get(lane)?.focus();
    }
    lastLanes.current = new Map(runs.map((run) => [run.runId, run.laneId]));
  }, [runs]);

  function focusWhenMounted(runId: string, attempts = 5) {
    ensureVisible.current.get(runId)?.();
    requestAnimationFrame(() => {
      const element = elements.current.get(runId);
      if (element) element.focus();
      else if (attempts > 0) focusWhenMounted(runId, attempts - 1);
    });
  }

  function onCardKeyDown(event: React.KeyboardEvent, runId: string) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentRuns = runsRef.current;
    const index = currentRuns.findIndex((run) => run.runId === runId);
    const target =
      event.key === 'Home'
        ? currentRuns[0]
        : event.key === 'End'
          ? currentRuns.at(-1)
          : currentRuns[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (target) focusWhenMounted(target.runId);
  }

  return useMemo(
    () => ({
      current,
      focusRun: (runId: string, fallbackLane?: DashboardLaneId) => {
        if (ensureVisible.current.has(runId)) {
          focusWhenMounted(runId);
          return;
        }
        laneHeaders.current.get(fallbackLane ?? lastLanes.current.get(runId)!)?.focus();
      },
      onCardKeyDown,
      registerCard: (runId: string, element: HTMLButtonElement | null, ensure: EnsureVisible) => {
        ensureVisible.current.set(runId, ensure);
        if (element) {
          elements.current.set(runId, element);
          if (current.current === runId && document.activeElement === document.body)
            requestAnimationFrame(() => element.focus());
        } else elements.current.delete(runId);
      },
      registerVirtualTarget: (runId: string, ensure: EnsureVisible) => {
        ensureVisible.current.set(runId, ensure);
      },
      registerLaneHeader: (lane: DashboardLaneId, element: HTMLElement | null) => {
        if (element) laneHeaders.current.set(lane, element);
        else laneHeaders.current.delete(lane);
      },
    }),
    [],
  );
}

export type RovingRunFocus = ReturnType<typeof useRovingRunFocus>;
