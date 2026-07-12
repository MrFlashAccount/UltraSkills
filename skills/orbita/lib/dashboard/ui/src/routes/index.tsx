import { createFileRoute } from "@tanstack/react-router";
import { DASHBOARD_LANE_ORDER, DashboardLaneIdSchema } from "@dashboard-contracts";
import { z } from "zod";
import { BoardScreen } from "@/features/board/BoardScreen";
import { useBoardModel } from "@/features/board/hooks/use-board-model";
import { useRovingRunFocus } from "@/features/board/hooks/use-roving-run-focus";
import { DashboardFetchError, useSnapshotQuery } from "@/features/board/hooks/use-snapshot-query";
import { useStableLaneOrder } from "@/features/board/hooks/use-stable-lane-order";
import { BoardLoading, EmptyRoot, SnapshotError } from "@/features/board/states/BoardStates";
import { selectFreshness } from "@/features/freshness/freshness-selector";
import { useDashboardEvents } from "@/features/freshness/use-dashboard-events";
import { useFreshnessNow } from "@/features/freshness/use-freshness-now";
import { useRunDetailQuery } from "@/features/run-detail/hooks/use-run-detail-query";

const searchSchema = z.object({
  lane: DashboardLaneIdSchema.optional().catch(undefined),
  q: z.string().max(120).optional().catch(undefined),
  run: z.string().max(160).optional().catch(undefined),
  workflow: z.string().max(120).optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  component: DashboardRoute,
  validateSearch: searchSchema,
});

function DashboardRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const snapshot = useSnapshotQuery();
  const now = useFreshnessNow();
  const events = useDashboardEvents(
    snapshot.data
      ? { changeId: snapshot.data.freshness.observerRevision, state: snapshot.data.freshness.state }
      : undefined,
    search.run,
  );
  const orderedRuns = useStableLaneOrder(snapshot.data?.runs ?? [], events.reconciliation);
  const filters = { lane: search.lane, q: search.q ?? "", workflow: search.workflow };
  const model = useBoardModel(orderedRuns, filters);
  const roving = useRovingRunFocus(DASHBOARD_LANE_ORDER.flatMap((lane) => model.lanes[lane]));
  const detail = useRunDetailQuery(search.run);
  const selectedLane = orderedRuns.find((run) => run.runId === search.run)?.laneId;
  const updateFilters = (change: Partial<typeof filters>) =>
    void navigate({ replace: true, search: (previous) => ({ ...previous, ...change }) });
  const closeDetail = () =>
    void navigate({ replace: true, search: (previous) => ({ ...previous, run: undefined }) });
  const selectRun = (runId: string) =>
    void navigate({ search: (previous) => ({ ...previous, run: runId }) });
  const returnFocus = () => {
    if (search.run) {
      roving.focusRun(search.run, selectedLane);
    }
  };
  if (snapshot.isPending) {
    return (
      <div className="dashboard-shell">
        <BoardLoading />
      </div>
    );
  }
  if (!snapshot.data) {
    const retry = () => void snapshot.refetch();
    return snapshot.error instanceof DashboardFetchError &&
      snapshot.error.code === "invalid_request" ? (
      <EmptyRoot onRetry={retry} />
    ) : (
      <SnapshotError onRetry={retry} />
    );
  }
  const freshness = selectFreshness(snapshot.data.freshness, {
    eventStale: events.observerStale,
    httpFailed: snapshot.isError,
    now,
    transport: events.transport,
  });
  return (
    <BoardScreen
      detail={detail.data}
      detailError={detail.isError}
      detailLoading={detail.isPending && Boolean(search.run)}
      filters={filters}
      freshness={freshness}
      model={model}
      onCloseDetail={closeDetail}
      onFiltersChange={updateFilters}
      onReturnFocus={returnFocus}
      onSelect={selectRun}
      roving={roving}
      selectedId={search.run}
      snapshot={snapshot.data}
    />
  );
}
