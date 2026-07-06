import { dashboardLanes } from '../constants/dashboard';
import { countsByLane } from '../view-models/filterRuns';
import type { DashboardRun } from '../types/dashboard';
import { Lane } from './Lane';
import styles from './dashboard.module.css';

type BoardProps = {
  onSelectRun: (runId: string) => void;
  runs: DashboardRun[];
  selectedRunId?: string;
};

export function Board({ onSelectRun, runs, selectedRunId }: BoardProps) {
  const counts = countsByLane(runs);
  return (
    <div className={styles.board} data-lane-count={dashboardLanes.length}>
      {dashboardLanes.map((lane) => (
        <Lane
          key={lane.id}
          count={counts.get(lane.id) ?? 0}
          lane={lane}
          onSelectRun={onSelectRun}
          runs={runs.filter((run) => run.laneId === lane.id)}
          selectedRunId={selectedRunId}
        />
      ))}
    </div>
  );
}
