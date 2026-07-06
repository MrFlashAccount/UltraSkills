import { useMemo, useState } from 'react';
import { Board } from './Board';
import { RunDrawer } from './RunDrawer';
import { StateSurface } from './StateSurface';
import { dashboardCopy } from '../constants/dashboard';
import { useDashboardRuns } from '../hooks/useDashboardRuns';
import { useDashboardSelection } from '../hooks/useDashboardSelection';
import { filterRuns } from '../view-models/filterRuns';
import styles from './dashboard.module.css';
import type { DashboardSnapshot } from '../types/dashboard';

type DashboardAppProps = {
  initialSnapshot?: DashboardSnapshot;
};

export function DashboardApp({ initialSnapshot }: DashboardAppProps) {
  const { error, freshnessLabel, loading, rootLabel, runs } = useDashboardRuns(initialSnapshot);
  const [searchQuery, setSearchQuery] = useState('');
  const visibleRuns = useMemo(() => filterRuns(runs, searchQuery), [runs, searchQuery]);
  const selection = useDashboardSelection(visibleRuns);

  return (
    <main className={styles.dashboard} data-read-only="true">
      <header className={styles.topbar} aria-label="Dashboard status">
        <div>
          <p className={styles.eyebrow}>Orbita runs</p>
          <h1>Read-only workflow board</h1>
        </div>
        <div className={styles.topbarMeta}>
          <span className={styles.sourcePill} title={rootLabel ?? dashboardCopy.emptyRoot}>
            {rootLabel ?? dashboardCopy.emptyRoot}
          </span>
          <label className={styles.searchLabel}>
            <span>Search</span>
            <input
              type="search"
              name="q"
              autoComplete="off"
              placeholder="Filter runs"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
            />
          </label>
          <span className={styles.freshness} aria-live="polite">{error ?? freshnessLabel}</span>
          <span className={styles.runCount}>{visibleRuns.length} runs</span>
        </div>
      </header>
      <section className={styles.boardShell} aria-label="Runs board">
        <StateSurface loading={loading} error={error} empty={visibleRuns.length === 0} />
        <Board
          runs={visibleRuns}
          selectedRunId={selection.selectedRunId}
          onSelectRun={selection.selectRun}
        />
        <RunDrawer run={selection.selectedRun} onClose={selection.closeSelection} />
      </section>
    </main>
  );
}
