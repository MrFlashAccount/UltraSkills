import type { RunSummaryDTO } from '@dashboard-contracts';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { RovingRunFocus } from './hooks/use-roving-run-focus';
import { RunCard } from './RunCard';

type VirtualLaneProps = {
  laneLabel: string;
  runs: readonly RunSummaryDTO[];
  selectedId?: string;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  roving: RovingRunFocus;
};

export function VirtualLane({ laneLabel, runs, selectedId, onSelect, roving }: VirtualLaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: runs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 146,
    overscan: 8,
    getItemKey: (index) => runs[index].runId,
    useFlushSync: false,
  });
  runs.forEach((run, index) =>
    roving.registerVirtualTarget(run.runId, () =>
      virtualizer.scrollToIndex(index, { align: 'auto' }),
    ),
  );
  if (!runs.length) return <div className="empty-lane">No runs in this lane</div>;
  return (
    <div ref={scrollRef} className="lane-scroll" data-testid="virtual-lane">
      <ul
        className="virtual-stack"
        aria-label={`${laneLabel} runs`}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const run = runs[item.index];
          const ensureVisible = () => virtualizer.scrollToIndex(item.index, { align: 'auto' });
          return (
            <li
              key={run.runId}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="virtual-card"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <RunCard
                run={run}
                selected={run.runId === selectedId}
                onSelect={onSelect}
                roving={roving}
                ensureVisible={ensureVisible}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
