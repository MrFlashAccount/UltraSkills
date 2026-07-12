import type { SnapshotEnvelope } from '@dashboard-contracts';
import type { RunDetailDTO } from '@dashboard-contracts';
import type { FreshnessView } from '@/features/freshness/freshness-selector';
import { RunDetailSurface } from '@/features/run-detail/RunDetailSurface';
import { Board } from './Board';
import { BoardToolbar } from './BoardToolbar';
import type { RovingRunFocus } from './hooks/use-roving-run-focus';
import type { ReturnTypeBoardModel } from './screen-types';
import { EmptyBoard, NoMatches } from './states/BoardStates';
import type { BoardFilters } from './selectors/board-selectors';

type BoardScreenProps = {
  snapshot: SnapshotEnvelope;
  model: ReturnTypeBoardModel;
  filters: BoardFilters;
  freshness: FreshnessView;
  selectedId?: string;
  detail?: RunDetailDTO | null;
  detailLoading: boolean;
  detailError: boolean;
  roving: RovingRunFocus;
  onFiltersChange: (change: Partial<BoardFilters>) => void;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  onCloseDetail: () => void;
  onReturnFocus: () => void;
};

export function BoardScreen(props: BoardScreenProps) {
  const noMatches = props.model.total > 0 && props.model.filtered.length === 0;
  return (
    <div className="dashboard-shell">
      <BoardToolbar
        filters={props.filters}
        workflows={props.model.workflows}
        total={props.model.total}
        freshness={props.freshness}
        onChange={props.onFiltersChange}
      />
      {props.freshness.unhealthy ? (
        <div className="stale-banner" role="status">
          {props.freshness.label}. Existing runs remain visible.
        </div>
      ) : null}
      <div className="dashboard-main" data-detail={props.selectedId ? 'open' : 'closed'}>
        <main className="board-region">
          {props.model.total === 0 ? (
            <EmptyBoard />
          ) : (
            <>
              {noMatches ? (
                <NoMatches
                  onClear={() =>
                    props.onFiltersChange({ q: '', workflow: undefined, lane: undefined })
                  }
                />
              ) : null}
              <Board
                lanes={props.model.lanes}
                counts={props.model.counts}
                selectedId={props.selectedId}
                onSelect={props.onSelect}
                roving={props.roving}
              />
            </>
          )}
        </main>
        <RunDetailSurface
          selectedId={props.selectedId}
          visibleInResults={props.model.filtered.some((run) => run.runId === props.selectedId)}
          detail={props.detail}
          isLoading={props.detailLoading}
          isError={props.detailError}
          onClose={props.onCloseDetail}
          onReturnFocus={props.onReturnFocus}
        />
      </div>
      <span className="sr-only" aria-live="polite">
        Snapshot version {props.snapshot.snapshotVersion}
      </span>
    </div>
  );
}
