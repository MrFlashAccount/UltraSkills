import { dashboardCopy, dashboardLanes, visibleRunWindow } from '../dashboardConstants';
import type { DashboardRun, DashboardViewModel } from '../dashboardTypes';
import { RunCard } from './RunCard';
import { RunDetailDrawer } from './RunDetailDrawer';
import type { RefObject } from 'react';
import styles from '../DashboardApp.module.css';

type DashboardBoardProps = {
  viewModel: DashboardViewModel;
  onSelectRun: (runId: string, card: HTMLElement | null) => void;
  onCloseDrawer: () => void;
  drawerRef: RefObject<HTMLElement | null>;
};

export function DashboardBoard({ viewModel, onSelectRun, onCloseDrawer, drawerRef }: DashboardBoardProps) {
  return (
    <section className={styles.boardShell} aria-label="Runs board">
      <div className={styles.board} data-lane-count={dashboardLanes.length}>
        {dashboardLanes.map((lane) => {
          const laneRuns = viewModel.runsByLane.get(lane.id) ?? [];
          return (
            <section className={`${styles.lane} ${styles[`lane_${lane.tone}`]}`} aria-labelledby={`lane-${lane.id}`} key={lane.id}>
              <header className={styles.laneHeader}>
                <h2 id={`lane-${lane.id}`}>{lane.label}</h2>
                <span className={styles.laneCount}>{laneRuns.length}</span>
              </header>
              <div className={styles.laneCards}>
                {laneRuns.length > 0
                  ? laneRuns.slice(0, visibleRunWindow).map((run) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      selected={run.id === viewModel.selectedRunId}
                      onSelect={onSelectRun}
                    />
                  ))
                  : <p className={styles.laneEmpty}>{emptyLaneMessage(lane.id)}</p>}
                {laneRuns.length > visibleRunWindow ? <WindowNotice hiddenCount={laneRuns.length - visibleRunWindow} /> : null}
              </div>
            </section>
          );
        })}
      </div>
      <RunDetailDrawer run={viewModel.selectedRun} onClose={onCloseDrawer} drawerRef={drawerRef} />
    </section>
  );
}

function WindowNotice({ hiddenCount }: { hiddenCount: number }) {
  return (
    <p className={styles.windowNotice}>
      Showing newest {visibleRunWindow}; {hiddenCount} older runs remain filterable.
    </p>
  );
}

function emptyLaneMessage(laneId: string) {
  return laneId === 'degraded' ? 'No degraded reads' : dashboardCopy.emptyResults;
}
