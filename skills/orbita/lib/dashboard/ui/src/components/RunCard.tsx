import type { DashboardRun } from '../types/dashboard';
import { relativeTimeLabel, shortRunId } from '../view-models/time';
import styles from './dashboard.module.css';

type RunCardProps = {
  onSelectRun: (runId: string) => void;
  run: DashboardRun;
  selected: boolean;
};

export function RunCard({ onSelectRun, run, selected }: RunCardProps) {
  return (
    <button
      type="button"
      className={`${styles.runCard} ${selected ? styles.runCardSelected : ''}`}
      data-run-id={run.id}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelectRun(run.id)}
    >
      <div className={styles.runCardTopline}>
        <span className={`${styles.statusChip} ${styles[`status_${run.laneId}`]}`}>{run.statusLabel}</span>
        <time dateTime={run.updatedAt ?? ''}>{relativeTimeLabel(run.updatedAt)}</time>
      </div>
      <h3>{run.title}</h3>
      <div className={styles.runCardMeta} aria-label="Run summary">
        <div><span>Run</span><strong><code>{shortRunId(run.id)}</code></strong></div>
        <div><span>Workflow</span><strong>{run.workflowName}</strong></div>
        <div><span>Step</span><strong><code>{run.stepId}</code></strong></div>
      </div>
      <CursorChips cursorBranches={run.cursorBranches} scope="card" />
    </button>
  );
}

export function CursorChips({ cursorBranches, scope }: { cursorBranches: string[]; scope: string }) {
  if (cursorBranches.length === 0) return null;
  return (
    <div className={`${styles.cursorChips} ${styles[`cursorChips_${scope}`]}`} aria-label="Active cursor branches">
      {cursorBranches.map((branch) => (
        <span key={branch} className={styles.cursorChip}><code>{branch}</code></span>
      ))}
    </div>
  );
}
