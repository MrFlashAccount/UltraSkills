import type { DashboardRun } from '../types/dashboard';
import { dashboardCopy } from '../constants/dashboard';
import styles from './dashboard.module.css';

export function MiniMap({ run }: { run: DashboardRun }) {
  if (run.miniMap.length === 0) return null;
  const activeSteps = new Set(run.cursorBranches);

  return (
    <section className={`${styles.drawerSection} ${styles.miniMap}`} data-secondary-surface="mini-map" aria-label={dashboardCopy.minimapLabel}>
      <h3>Workflow mini-map</h3>
      <ol>
        {run.miniMap.map((step) => {
          const id = String(step.id ?? step.stepId ?? '');
          const state = activeSteps.has(id) ? 'active' : step.state || 'pending';
          return <li key={id} className={`${styles.miniMapStep} ${styles[`miniMapStep_${state}`]}`}><code>{id}</code><span>{state}</span></li>;
        })}
      </ol>
      {run.miniMapProvenance ? <p className={styles.miniMapProvenance}>{run.miniMapProvenance}</p> : null}
    </section>
  );
}
