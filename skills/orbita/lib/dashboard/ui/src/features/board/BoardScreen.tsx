import type { SnapshotEnvelope } from "@dashboard-contracts";
import type { RunDetailDTO } from "@dashboard-contracts";
import type { FreshnessView } from "@/features/freshness/freshness-selector";
import { RunDetailSurface } from "@/features/run-detail/RunDetailSurface";
import { Board } from "./Board";
import { BoardToolbar } from "./BoardToolbar";
import type { RovingRunFocus } from "./hooks/use-roving-run-focus";
import type { ReturnTypeBoardModel } from "./screen-types";
import { EmptyBoard, NoMatches } from "./states/BoardStates";
import type { BoardFilters } from "./selectors/board-selectors";

type BoardScreenProps = {
  detail?: RunDetailDTO | null | undefined;
  detailError: boolean;
  detailLoading: boolean;
  filters: BoardFilters;
  freshness: FreshnessView;
  model: ReturnTypeBoardModel;
  onCloseDetail: () => void;
  onFiltersChange: (change: Partial<BoardFilters>) => void;
  onReturnFocus: () => void;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  roving: RovingRunFocus;
  selectedId?: string | undefined;
  snapshot: SnapshotEnvelope;
};

export function BoardScreen(props: BoardScreenProps) {
  const noMatches = props.model.total > 0 && props.model.filtered.length === 0;
  return (
    <div className="dashboard-shell">
      <BoardToolbar
        filters={props.filters}
        freshness={props.freshness}
        onChange={props.onFiltersChange}
        total={props.model.total}
        workflows={props.model.workflows}
      />
      {props.freshness.unhealthy ? (
        <output className="stale-banner">
          {props.freshness.label}. Existing runs remain visible.
        </output>
      ) : null}
      <div className="dashboard-main" data-detail={props.selectedId ? "open" : "closed"}>
        <main className="board-region">
          {props.model.total === 0 ? (
            <EmptyBoard />
          ) : (
            <>
              {noMatches ? (
                <NoMatches
                  onClear={() =>
                    props.onFiltersChange({ lane: undefined, q: "", workflow: undefined })
                  }
                />
              ) : null}
              <Board
                counts={props.model.counts}
                lanes={props.model.lanes}
                onSelect={props.onSelect}
                roving={props.roving}
                selectedId={props.selectedId}
              />
            </>
          )}
        </main>
        <RunDetailSurface
          detail={props.detail}
          isError={props.detailError}
          isLoading={props.detailLoading}
          onClose={props.onCloseDetail}
          onReturnFocus={props.onReturnFocus}
          selectedId={props.selectedId}
          visibleInResults={props.model.filtered.some((run) => run.runId === props.selectedId)}
        />
      </div>
      <span aria-live="polite" className="sr-only">
        Snapshot version {props.snapshot.snapshotVersion}
      </span>
    </div>
  );
}
