import type { RunSummaryDTO } from "@dashboard-contracts";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { RovingRunFocus } from "./hooks/use-roving-run-focus";
import { RunCard } from "./RunCard";

type VirtualLaneProps = {
  laneLabel: string;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  roving: RovingRunFocus;
  runs: ReadonlyArray<RunSummaryDTO>;
  selectedId?: string | undefined;
};

export function VirtualLane({ laneLabel, onSelect, roving, runs, selectedId }: VirtualLaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: runs.length,
    estimateSize: () => 146,
    getItemKey: (index) => runs[index]!.runId,
    getScrollElement: () => scrollRef.current,
    overscan: 8,
    useFlushSync: false,
  });
  runs.forEach((run, index) =>
    roving.registerVirtualTarget(run.runId, () =>
      virtualizer.scrollToIndex(index, { align: "auto" }),
    ),
  );
  if (!runs.length) {
    return <div className="empty-lane">No runs in this lane</div>;
  }
  return (
    <div className="lane-scroll" data-testid="virtual-lane" ref={scrollRef}>
      <ul
        aria-label={`${laneLabel} runs`}
        className="virtual-stack"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const run = runs[item.index]!;
          const ensureVisible = () => virtualizer.scrollToIndex(item.index, { align: "auto" });
          return (
            <li
              className="virtual-card"
              data-index={item.index}
              key={run.runId}
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <RunCard
                ensureVisible={ensureVisible}
                onSelect={onSelect}
                roving={roving}
                run={run}
                selected={run.runId === selectedId}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
