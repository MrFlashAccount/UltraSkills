import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { Button, SearchField, Input, Label } from 'react-aria-components';
import { createDashboardViewModel, redactControlText, shortRunId } from './contracts';
import { dashboardCopy, dashboardWindowSize } from './constants';
import { shouldFocusDrawerControl } from './interaction';
import type { DrawerFocusIntent } from './interaction';
import type { DashboardLaneId, DashboardRun, DashboardSnapshot } from './types';
import styles from './Dashboard.module.css';

type DashboardProps = {
  snapshot: DashboardSnapshot;
  drawerFocusIntent: DrawerFocusIntent;
  onSearchChange: (query: string) => void;
  onSelectRun: (runId: string) => void;
  onCloseDrawer: () => void;
  errorMessage?: string;
};

const statusClassByLane: Record<DashboardLaneId, string> = {
  waiting_for_user: styles.statusWaiting,
  worker_running: styles.statusRunning,
  blocked: styles.statusBlocked,
  degraded: styles.statusDegraded,
  done: styles.statusDone,
};

export function Dashboard({ snapshot, drawerFocusIntent, onSearchChange, onSelectRun, onCloseDrawer, errorMessage }: DashboardProps): ReactElement {
  const model = useMemo(() => createDashboardViewModel(snapshot), [snapshot]);
  const selectedId = model.selectedRun?.id ?? null;

  return (
    <main className={styles.dashboard} data-read-only="true">
      <header className={styles.topbar} aria-label="Dashboard status">
        <div>
          <p className={styles.eyebrow}>Orbita runs</p>
          <h1>Read-only workflow board</h1>
        </div>
        <div className={styles.topbarMeta}>
          <span className={styles.sourcePill} title={model.rootLabel}>{model.rootLabel}</span>
          <SearchField className={styles.searchField} value={model.searchQuery} onChange={onSearchChange}>
            <Label>Search</Label>
            <Input name="q" autoComplete="off" placeholder="Filter runs" />
          </SearchField>
          <span className={styles.freshness} aria-live="polite">{errorMessage ?? model.freshness}</span>
          <span className={styles.runCount}>{model.runs.length} runs</span>
        </div>
      </header>
      {errorMessage ? <p role="alert" className={styles.stateMessage}>{errorMessage}</p> : null}
      <section className={styles.boardShell} aria-label="Runs board">
        <div className={styles.board} data-lane-count={model.lanes.length}>
          {model.lanes.map((lane) => (
            <Lane
              key={lane.id}
              laneId={lane.id}
              label={lane.label}
              count={model.countsByLane.get(lane.id) ?? 0}
              runs={model.visibleRunsByLane.get(lane.id) ?? []}
              selectedRunId={selectedId}
              onSelectRun={onSelectRun}
            />
          ))}
        </div>
        <Drawer run={model.selectedRun} drawerFocusIntent={drawerFocusIntent} onCloseDrawer={onCloseDrawer} />
      </section>
    </main>
  );
}

type LaneProps = {
  laneId: DashboardLaneId;
  label: string;
  count: number;
  runs: DashboardRun[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
};

function Lane({ laneId, label, count, runs, selectedRunId, onSelectRun }: LaneProps): ReactElement {
  const visibleRuns = runs.slice(0, dashboardWindowSize);
  const hiddenCount = runs.length - visibleRuns.length;

  return (
    <section className={styles.lane} aria-labelledby={`lane-${laneId}`}>
      <header className={styles.laneHeader}>
        <h2 id={`lane-${laneId}`}>{label}</h2>
        <span className={styles.laneCount}>{count}</span>
      </header>
      <div className={styles.laneCards}>
        {visibleRuns.length > 0
          ? visibleRuns.map((run) => (
            <RunCard key={run.id} run={run} selected={run.id === selectedRunId} onSelectRun={onSelectRun} />
          ))
          : <p className={styles.emptyLane}>{laneId === 'degraded' ? 'No degraded reads' : dashboardCopy.emptyResults}</p>}
        {hiddenCount > 0 ? <span className={styles.windowNote}>Showing first {dashboardWindowSize} of {runs.length}</span> : null}
      </div>
    </section>
  );
}

type RunCardProps = {
  run: DashboardRun;
  selected: boolean;
  onSelectRun: (runId: string) => void;
};

function RunCard({ run, selected, onSelectRun }: RunCardProps): ReactElement {
  return (
    <Button
      className={`${styles.runCard} ${selected ? styles.selectedRunCard : ''}`}
      data-run-id={run.id}
      aria-current={selected ? 'true' : undefined}
      onPress={() => onSelectRun(run.id)}
    >
      <div className={styles.runCardTopline}>
        <span className={`${styles.statusChip} ${statusClassByLane[run.laneId]}`}>{run.statusLabel}</span>
        <time dateTime={run.updatedAt ?? ''}>{run.updatedAt ?? 'freshness unknown'}</time>
      </div>
      <h3>{run.title}</h3>
      <MetaList rows={[
        ['Run', shortRunId(run.id), true],
        ['Workflow', run.workflowName, false],
        ['Step', run.stepId, true],
      ]} />
      <CursorChips cursorBranches={run.cursorBranches} />
    </Button>
  );
}

type DrawerProps = {
  run: DashboardRun | null;
  drawerFocusIntent: DrawerFocusIntent;
  onCloseDrawer: () => void;
};

function Drawer({ run, drawerFocusIntent, onCloseDrawer }: DrawerProps): ReactElement {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (shouldFocusDrawerControl({ runId: run?.id ?? null, focusIntent: drawerFocusIntent })) {
      closeButtonRef.current?.focus();
    }
  }, [drawerFocusIntent, run?.id]);

  if (!run) {
    return (
      <aside className={`${styles.drawer} ${styles.drawerEmpty}`} aria-label="Run details">
        <p>{dashboardCopy.drawerEmpty}</p>
      </aside>
    );
  }

  return (
    <aside
      className={styles.drawer}
      aria-label="Run details"
      data-run-id={run.id}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCloseDrawer();
      }}
    >
      <header className={styles.drawerHeader}>
        <div className={styles.drawerTitleRow}>
          <div>
            <p className={styles.eyebrow}>Run details</p>
            <h2>{run.title}</h2>
          </div>
          <Button
            ref={closeButtonRef}
            className={styles.drawerCloseButton}
            aria-label="Close run details"
            onPress={onCloseDrawer}
          >
            Close
          </Button>
        </div>
        <p className={styles.drawerSummary}>{run.summary ?? ''}</p>
      </header>
      <MetaList rows={[
        ['Run id', run.id, true],
        ['Workflow', run.workflowName, false],
        ['Current status', run.statusLabel, false],
        ['Current step', run.stepId, true],
      ]} />
      <CursorChips cursorBranches={run.cursorBranches} />
      <MiniMap run={run} />
      <Artifacts run={run} />
      <History run={run} />
      <Diagnostics run={run} />
    </aside>
  );
}

function MetaList({ rows }: { rows: [string, string, boolean][] }): ReactElement {
  return (
    <dl className={styles.metaList}>
      {rows.map(([label, value, code]) => (
        <div className={styles.metaRow} key={label}>
          <dt>{label}</dt>
          <dd>{code ? <code>{value}</code> : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CursorChips({ cursorBranches }: { cursorBranches: string[] }): ReactElement | null {
  if (cursorBranches.length === 0) return null;
  return (
    <div className={styles.cursorChips} aria-label="Active cursor branches">
      {cursorBranches.map((branch) => <span className={styles.cursorChip} key={branch}><code>{branch}</code></span>)}
    </div>
  );
}

function MiniMap({ run }: { run: DashboardRun }): ReactElement | null {
  if (run.miniMap.length === 0) return null;
  const active = new Set(run.cursorBranches);
  return (
    <section className={styles.drawerSection} data-secondary-surface="mini-map" aria-label={dashboardCopy.minimapLabel}>
      <h3>Workflow mini-map</h3>
      <ol className={styles.miniMapList}>
        {run.miniMap.map((step) => {
          const state = active.has(step.id) ? 'active' : step.state;
          return (
            <li className={`${styles.miniMapStep} ${state === 'active' ? styles.miniMapActive : ''} ${state === 'completed' ? styles.miniMapCompleted : ''}`} key={step.id}>
              <code>{step.id}</code>
              <span>{state}</span>
            </li>
          );
        })}
      </ol>
      {run.miniMapProvenance ? <p>{run.miniMapProvenance}</p> : null}
    </section>
  );
}

function Artifacts({ run }: { run: DashboardRun }): ReactElement | null {
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

function History({ run }: { run: DashboardRun }): ReactElement | null {
  if (run.historyExcerpt.length === 0) return null;
  return (
    <section className={styles.drawerSection} aria-label="Bounded history excerpt">
      <h3>Bounded history excerpt</h3>
      <ol className={styles.historyList}>
        {run.historyExcerpt.slice(0, 6).map((entry) => (
          <li key={`${entry.at ?? ''}-${entry.summary}`}>
            <time dateTime={entry.at ?? ''}>{entry.age ?? entry.at ?? ''}</time>
            <span>{redactControlText(entry.summary)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Diagnostics({ run }: { run: DashboardRun }): ReactElement | null {
  if (run.diagnostics.length === 0) return null;
  return (
    <section className={styles.drawerSection} aria-label="Degraded diagnostics">
      <h3>Degraded diagnostics</h3>
      <ul className={styles.diagnosticsList}>
        {run.diagnostics.map((diagnostic) => <li key={`${diagnostic.severity}-${diagnostic.message}`}><strong>{diagnostic.severity}</strong><span>{diagnostic.message}</span></li>)}
      </ul>
    </section>
  );
}

export function DashboardLoading(): ReactElement {
  return <main className={styles.dashboard}><p className={styles.stateMessage}>{dashboardCopy.loading}</p></main>;
}

export function DashboardError({ message }: { message: string }): ReactElement {
  return <main className={styles.dashboard}><p role="alert" className={styles.stateMessage}>{dashboardCopy.errorTitle}: {message}</p></main>;
}
