import { createFileRoute } from '@tanstack/react-router';
import { DASHBOARD_LANE_ORDER, DashboardLaneIdSchema } from '@dashboard-contracts';
import { z } from 'zod';
import { useCallback, useMemo } from 'react';
import { BoardScreen } from '@/features/board/BoardScreen';
import { useBoardModel } from '@/features/board/hooks/use-board-model';
import { useRovingRunFocus } from '@/features/board/hooks/use-roving-run-focus';
import { DashboardFetchError, useSnapshotQuery } from '@/features/board/hooks/use-snapshot-query';
import { useStableLaneOrder } from '@/features/board/hooks/use-stable-lane-order';
import { BoardLoading, EmptyRoot, SnapshotError } from '@/features/board/states/BoardStates';
import { selectFreshness } from '@/features/freshness/freshness-selector';
import { useDashboardEvents } from '@/features/freshness/use-dashboard-events';
import { useFreshnessNow } from '@/features/freshness/use-freshness-now';
import { useRunDetailQuery } from '@/features/run-detail/hooks/use-run-detail-query';

const searchSchema = z.object({
  q: z.string().max(120).optional().catch(undefined),
  workflow: z.string().max(120).optional().catch(undefined),
  lane: DashboardLaneIdSchema.optional().catch(undefined),
  run: z.string().max(160).optional().catch(undefined),
});

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  component: DashboardRoute,
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
  const filters = useMemo(
    () => ({ q: search.q ?? '', workflow: search.workflow, lane: search.lane }),
    [search.q, search.workflow, search.lane],
  );
  const model = useBoardModel(orderedRuns, filters);
  const roving = useRovingRunFocus(DASHBOARD_LANE_ORDER.flatMap((lane) => model.lanes[lane]));
  const detail = useRunDetailQuery(search.run);
  const selectedLane = orderedRuns.find((run) => run.runId === search.run)?.laneId;
  const updateFilters = useCallback(
    (change: Partial<typeof filters>) =>
      void navigate({ search: (previous) => ({ ...previous, ...change }), replace: true }),
    [navigate],
  );
  const closeDetail = useCallback(
    () => void navigate({ search: (previous) => ({ ...previous, run: undefined }), replace: true }),
    [navigate],
  );
  const selectRun = useCallback(
    (runId: string) => void navigate({ search: (previous) => ({ ...previous, run: runId }) }),
    [navigate],
  );
  const returnFocus = useCallback(() => {
    if (search.run) roving.focusRun(search.run, selectedLane);
  }, [roving, search.run, selectedLane]);
  if (snapshot.isPending)
    return (
      <div className="dashboard-shell">
        <BoardLoading />
      </div>
    );
  if (!snapshot.data) {
    const retry = () => void snapshot.refetch();
    return snapshot.error instanceof DashboardFetchError &&
      snapshot.error.code === 'invalid_request' ? (
      <EmptyRoot onRetry={retry} />
    ) : (
      <SnapshotError onRetry={retry} />
    );
  }
  const freshness = selectFreshness(snapshot.data.freshness, {
    transport: events.transport,
    eventStale: events.observerStale,
    httpFailed: snapshot.isError,
    now,
  });
  return (
    <BoardScreen
      snapshot={snapshot.data}
      model={model}
      filters={filters}
      freshness={freshness}
      selectedId={search.run}
      detail={detail.data}
      detailLoading={detail.isPending && Boolean(search.run)}
      detailError={detail.isError}
      roving={roving}
      onFiltersChange={updateFilters}
      onSelect={selectRun}
      onCloseDetail={closeDetail}
      onReturnFocus={returnFocus}
    />
  );
}
