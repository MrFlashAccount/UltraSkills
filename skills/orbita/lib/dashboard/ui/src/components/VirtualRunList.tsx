import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DashboardLaneId, DashboardRun } from '../types/dashboard';
import { shouldVirtualizeRunList } from '../view-models/virtualization';
import { RunCard } from './RunCard';
import styles from './dashboard.module.css';

type VirtualRunListProps = {
  laneId: DashboardLaneId;
  onSelectRun: (runId: string) => void;
  runs: DashboardRun[];
  selectedRunId?: string;
};

export function VirtualRunList({ laneId, onSelectRun, runs, selectedRunId }: VirtualRunListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: runs.length,
    estimateSize: () => 176,
    getScrollElement: () => parentRef.current,
    overscan: 6,
    useFlushSync: false,
  });

  if (!shouldVirtualizeRunList(runs.length)) {
    return (
      <div className={styles.laneCards}>
        {runs.map((run) => (
          <RunCard key={run.id} run={run} selected={run.id === selectedRunId} onSelectRun={onSelectRun} />
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className={styles.virtualLaneCards} data-virtualized-lane={laneId}>
      <div className={styles.virtualLaneSpacer} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const run = runs[item.index];
          if (!run) return null;
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              className={styles.virtualLaneItem}
              data-index={item.index}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <RunCard run={run} selected={run.id === selectedRunId} onSelectRun={onSelectRun} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
