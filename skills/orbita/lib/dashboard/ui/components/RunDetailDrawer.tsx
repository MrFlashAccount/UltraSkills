import { Button } from 'react-aria-components';
import { dashboardCopy } from '../dashboardConstants';
import type { DashboardRun } from '../dashboardTypes';
import type { RefObject } from 'react';
import { CursorChips } from './SharedParts';
import styles from '../DashboardApp.module.css';

type RunDetailDrawerProps = {
  run: DashboardRun | null;
  onClose: () => void;
  drawerRef: RefObject<HTMLElement | null>;
};

export function RunDetailDrawer({ run, onClose, drawerRef }: RunDetailDrawerProps) {
  if (!run) {
    return (
      <aside className={`${styles.drawer} ${styles.drawerEmpty}`} aria-label="Run details">
        <p>{dashboardCopy.drawerEmpty}</p>
      </aside>
    );
  }

  return (
    <aside className={styles.drawer} aria-label="Run details" data-run-id={run.id} data-run-detail-drawer="true" ref={drawerRef} tabIndex={-1}>
      <header className={styles.drawerHeader}>
        <div className={styles.drawerTitleRow}>
          <div>
            <p className={styles.eyebrow}>Run details</p>
            <h2>{run.title}</h2>
          </div>
          <Button className={styles.closeButton} onPress={onClose} aria-label="Close details">Close</Button>
        </div>
        {run.summary ? <p className={styles.drawerSummary}>{run.summary}</p> : null}
      </header>
      <RunFacts run={run} />
      <CursorChips cursorBranches={run.cursorBranches} scope="drawer" />
      <MiniMap run={run} />
      <Artifacts run={run} />
      <History run={run} />
      <Diagnostics run={run} />
    </aside>
  );
}

function RunFacts({ run }: { run: DashboardRun }) {
  return (
    <dl className={styles.drawerFacts}>
      <div><dt>Run id</dt><dd><code>{run.id}</code></dd></div>
      <div><dt>Workflow</dt><dd>{run.workflowName}</dd></div>
      <div><dt>Current status</dt><dd>{run.statusLabel}</dd></div>
      <div><dt>Current step</dt><dd><code>{run.stepId}</code></dd></div>
    </dl>
  );
}

function MiniMap({ run }: { run: DashboardRun }) {
  if (run.miniMap.length === 0) return null;
  return (
    <section className={styles.drawerSection} data-secondary-surface="mini-map" aria-label={dashboardCopy.minimapLabel}>
      <h3>Workflow mini-map</h3>
      <ol className={styles.miniMapList}>
        {run.miniMap.map((step) => (
          <li className={`${styles.miniMapStep} ${styles[`miniMap_${step.state}`] ?? ''}`} key={step.id}>
            <code>{step.id}</code><span>{step.state}</span>
          </li>
        ))}
      </ol>
      {run.miniMapProvenance ? <p className={styles.miniMapProvenance}>{run.miniMapProvenance}</p> : null}
    </section>
  );
}

function Artifacts({ run }: { run: DashboardRun }) {
  if (run.artifacts.length === 0) return null;
  return (
    <section className={styles.drawerSection} aria-label="Artifacts">
      <h3>Artifacts</h3>
      <ul className={styles.artifactList}>
        {run.artifacts.map((artifact) => (
          <li key={`${artifact.id}-${artifact.contentType}`}>
            <code>{artifact.id}</code><span>{artifact.summary || artifact.contentType}</span>
          </li>
        ))}
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
        {run.historyExcerpt.slice(0, 6).map((entry, index) => (
          <li key={`${entry.summary}-${index}`}>
            <time dateTime={entry.at}>{entry.age || entry.at}</time><span>{entry.summary}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Diagnostics({ run }: { run: DashboardRun }) {
  if (run.diagnostics.length === 0) return null;
  return (
    <section className={`${styles.drawerSection} ${styles.diagnostics}`} aria-label="Degraded diagnostics">
      <h3>Degraded diagnostics</h3>
      <ul>
        {run.diagnostics.map((diagnostic) => (
          <li key={`${diagnostic.severity}-${diagnostic.message}`}>
            <strong>{diagnostic.severity}</strong><span>{diagnostic.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
