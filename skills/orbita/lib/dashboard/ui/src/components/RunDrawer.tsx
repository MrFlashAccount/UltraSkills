import { Button } from 'react-aria-components';
import type { DashboardRun } from '../types/dashboard';
import { CursorChips } from './RunCard';
import { MiniMap } from './MiniMap';
import { redactControlText } from '../view-models/time';
import { dashboardCopy } from '../constants/dashboard';
import styles from './dashboard.module.css';

type RunDrawerProps = {
  onClose: () => void;
  run?: DashboardRun;
};

export function RunDrawer({ onClose, run }: RunDrawerProps) {
  if (!run) {
    return <aside className={`${styles.drawer} ${styles.drawerEmpty}`} aria-label="Run details"><p>{dashboardCopy.drawerEmpty}</p></aside>;
  }

  return (
    <aside className={styles.drawer} aria-label="Run details" data-run-id={run.id} tabIndex={-1}>
      <header className={styles.drawerHeader}>
        <div className={styles.drawerTitleRow}>
          <div>
            <p className={styles.eyebrow}>Run details</p>
            <h2>{run.title}</h2>
          </div>
          <Button className={styles.iconButton} onPress={onClose} aria-label="Close details">x</Button>
        </div>
        <p className={styles.drawerSummary}>{run.summary ?? ''}</p>
      </header>
      <dl className={styles.drawerFacts}>
        <div><dt>Run id</dt><dd><code>{run.id}</code></dd></div>
        <div><dt>Workflow</dt><dd>{run.workflowName}</dd></div>
        <div><dt>Current status</dt><dd>{run.statusLabel}</dd></div>
        <div><dt>Current step</dt><dd><code>{run.stepId}</code></dd></div>
      </dl>
      <CursorChips cursorBranches={run.cursorBranches} scope="drawer" />
      <MiniMap run={run} />
      <Artifacts run={run} />
      <History run={run} />
      <Diagnostics run={run} />
    </aside>
  );
}

function Artifacts({ run }: { run: DashboardRun }) {
  if (run.artifacts.length === 0) return null;
  return (
    <section className={styles.drawerSection} aria-label="Artifacts">
      <h3>Artifacts</h3>
      <ul className={styles.artifactList}>
        {run.artifacts.map((artifact) => <li key={artifact.id}><code>{artifact.id}</code><span>{artifact.summary ?? artifact.contentType ?? ''}</span></li>)}
      </ul>
    </section>
  );
}

function History({ run }: { run: DashboardRun }) {
  if (run.historyExcerpt.length === 0) return null;
  return (
    <section className={styles.drawerSection} aria-label="Bounded history excerpt">
      <h3>Bounded history excerpt</h3>
      <ol className={styles.historyList}>
        {run.historyExcerpt.slice(0, 6).map((entry) => <li key={`${entry.at}-${entry.summary}`}><time dateTime={entry.at ?? ''}>{entry.age ?? entry.at ?? ''}</time><span>{redactControlText(entry.summary ?? '')}</span></li>)}
      </ol>
    </section>
  );
}

function Diagnostics({ run }: { run: DashboardRun }) {
  if (run.diagnostics.length === 0) return null;
  return (
    <section className={`${styles.drawerSection} ${styles.diagnostics}`} aria-label="Degraded diagnostics">
      <h3>Degraded diagnostics</h3>
      <ul>{run.diagnostics.map((diagnostic) => <li key={diagnostic.message ?? diagnostic.summary}><strong>{diagnostic.severity ?? 'info'}</strong><span>{diagnostic.message ?? diagnostic.summary ?? ''}</span></li>)}</ul>
    </section>
  );
}
