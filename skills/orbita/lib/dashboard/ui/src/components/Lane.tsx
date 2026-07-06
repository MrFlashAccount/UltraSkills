import type { DashboardLane, DashboardRun } from '../types/dashboard';
import { EmptyLane } from './StateSurface';
import { VirtualRunList } from './VirtualRunList';
import styles from './dashboard.module.css';

type LaneProps = {
  count: number;
  lane: DashboardLane;
  onSelectRun: (runId: string) => void;
  runs: DashboardRun[];
  selectedRunId?: string;
};

export function Lane({ count, lane, onSelectRun, runs, selectedRunId }: LaneProps) {
  return (
    <section className={`${styles.lane} ${styles[`lane_${lane.tone}`]}`} aria-labelledby={`lane-${lane.id}`}>
      <header className={styles.laneHeader}>
        <h2 id={`lane-${lane.id}`}>{lane.label}</h2>
        <span className={styles.laneCount}>{count}</span>
      </header>
      {runs.length > 0 ? (
        <VirtualRunList
          laneId={lane.id}
          onSelectRun={onSelectRun}
          runs={runs}
          selectedRunId={selectedRunId}
        />
      ) : (
        <EmptyLane laneId={lane.id} />
      )}
    </section>
  );
}
