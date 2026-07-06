import { relativeTimeLabel, shortRunId } from '../dashboardModel';
import type { DashboardRun } from '../dashboardTypes';
import { CursorChips } from './SharedParts';
import styles from '../DashboardApp.module.css';

type RunCardProps = {
  run: DashboardRun;
  selected: boolean;
  onSelect: (runId: string, card: HTMLElement | null) => void;
};

export function RunCard({ run, selected, onSelect }: RunCardProps) {
  return (
    <article
      className={`${styles.runCard} ${selected ? styles.runCardSelected : ''}`}
      tabIndex={0}
      data-run-id={run.id}
      aria-current={selected ? 'true' : undefined}
      onClick={(event) => onSelect(run.id, event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(run.id, event.currentTarget);
      }}
    >
      <div className={styles.runCardTopline}>
        <span className={`${styles.statusChip} ${styles[`status_${run.laneId}`]}`}>{run.statusLabel}</span>
        <time dateTime={run.updatedAt}>{relativeTimeLabel(run.updatedAt)}</time>
      </div>
      <h3>{run.title}</h3>
      <dl className={styles.runCardMeta}>
        <div><dt>Run</dt><dd><code>{shortRunId(run.id)}</code></dd></div>
        <div><dt>Workflow</dt><dd>{run.workflowName}</dd></div>
        <div><dt>Step</dt><dd><code>{run.stepId}</code></dd></div>
      </dl>
      <CursorChips cursorBranches={run.cursorBranches} scope="card" />
    </article>
  );
}
