import type { DashboardLaneId, RunSummaryDTO } from "@dashboard-contracts";
import { useEffect, useRef, useState } from "react";

type EnsureVisible = () => void;

export function useRovingRunFocus(runs: ReadonlyArray<RunSummaryDTO>) {
  const current = useRef<string | undefined>(undefined);
  const [elements] = useState(() => new Map<string, HTMLButtonElement>());
  const [ensureVisible] = useState(() => new Map<string, EnsureVisible>());
  const [laneHeaders] = useState(() => new Map<DashboardLaneId, HTMLElement>());
  const [lastLanes] = useState(() => new Map<string, DashboardLaneId>());

  useEffect(() => {
    const activeIds = new Set(runs.map((run) => run.runId));
    for (const runId of elements.keys()) {
      if (!activeIds.has(runId)) {
        elements.delete(runId);
      }
    }
    for (const runId of ensureVisible.keys()) {
      if (!activeIds.has(runId)) {
        ensureVisible.delete(runId);
      }
    }
    if (current.current && !runs.some((run) => run.runId === current.current)) {
      const lane = lastLanes.get(current.current);
      current.current = undefined;
      if (lane && document.activeElement === document.body) {
        laneHeaders.get(lane)?.focus();
      }
    }
    lastLanes.clear();
    for (const run of runs) {
      lastLanes.set(run.runId, run.laneId);
    }
  }, [elements, ensureVisible, laneHeaders, lastLanes, runs]);

  function focusWhenMounted(runId: string, attempts = 5) {
    ensureVisible.get(runId)?.();
    requestAnimationFrame(() => {
      const element = elements.get(runId);
      if (element) {
        element.focus();
      } else if (attempts > 0) {
        focusWhenMounted(runId, attempts - 1);
      }
    });
  }

  function onCardKeyDown(event: React.KeyboardEvent, runId: string) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const index = runs.findIndex((run) => run.runId === runId);
    const target =
      event.key === "Home"
        ? runs[0]
        : event.key === "End"
          ? runs.at(-1)
          : runs[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (target) {
      focusWhenMounted(target.runId);
    }
  }

  return {
    focusRun: (runId: string, fallbackLane?: DashboardLaneId) => {
      if (ensureVisible.has(runId)) {
        focusWhenMounted(runId);
        return;
      }
      laneHeaders.get(fallbackLane ?? lastLanes.get(runId)!)?.focus();
    },
    onCardKeyDown,
    registerCard: (runId: string, element: HTMLButtonElement | null, ensure: EnsureVisible) => {
      ensureVisible.set(runId, ensure);
      if (element) {
        elements.set(runId, element);
        if (current.current === runId && document.activeElement === document.body) {
          requestAnimationFrame(() => element.focus());
        }
      } else {
        elements.delete(runId);
      }
    },
    registerLaneHeader: (lane: DashboardLaneId, element: HTMLElement | null) => {
      if (element) {
        laneHeaders.set(lane, element);
      } else {
        laneHeaders.delete(lane);
      }
    },
    registerVirtualTarget: (runId: string, ensure: EnsureVisible) => {
      ensureVisible.set(runId, ensure);
    },
    setCurrent(runId: string) {
      current.current = runId;
    },
  };
}

export type RovingRunFocus = ReturnType<typeof useRovingRunFocus>;
