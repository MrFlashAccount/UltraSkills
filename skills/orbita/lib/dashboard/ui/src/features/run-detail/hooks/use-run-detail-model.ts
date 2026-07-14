import type { RunLightDetailDTO, WorkflowPageDTO } from "@dashboard-contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type OccurrenceEvidenceState, type PagingState } from "../run-detail-view-model";
import {
  accumulatePages,
  mergeTraversalPages,
  selectOccurrence,
  toActivityGroups,
  toManagedLogEntries,
  toOccurrenceItems,
  toRunArtifactItems,
} from "../selectors/page-selectors";
import { isStaleLocatorError, resourceQueryKey } from "./query-client";
import {
  useActivityPages,
  useLogPages,
  useOccurrenceArtifactPages,
  useTraversalPages,
  useWorkflowPages,
} from "./use-run-inspection-queries";

/** Owns run-scoped query and selection state; no identity survives a run-id transition. */
export function useRunDetailModel(detail: RunLightDetailDTO) {
  const runId = detail.run.runId;
  const client = useQueryClient();
  const workflow = useWorkflowPages(runId);
  const traversal = useTraversalPages(runId);
  const occurrences = toOccurrenceItems(traversal.data?.pages);
  const [selection, setSelection] = useState<{ ref: string; runId: string }>();
  const explicitSelection = selection?.runId === runId ? selection.ref : undefined;
  const selected = selectOccurrence(occurrences, explicitSelection);
  const selectedRef = selected?.occurrenceRef;
  const activity = useActivityPages(runId, selectedRef);
  const logs = useLogPages(runId, selectedRef);
  const artifacts = useOccurrenceArtifactPages(runId, selectedRef);
  const traversalRecords = mergeTraversalPages(traversal.data?.pages);
  const selectedRecord = traversalRecords.find(
    (occurrence) => occurrence.occurrenceRef === selectedRef,
  );
  const workflowNodes = accumulatePages(
    workflow.data?.pages.map((page) => ({ items: page.nodes })),
    (node) => node.stepId,
  );
  const workflowEdges = accumulateEdges(workflow.data?.pages);
  const selectedArtifactItems = toRunArtifactItems(runId, artifacts.data?.pages);
  const activityGroups = toActivityGroups(activity.data?.pages, selectedRecord);
  const logEntries = toManagedLogEntries(logs.data?.pages);
  const legacyUnavailable =
    detail.occurrenceAvailability === "legacy_unavailable" ||
    traversal.data?.pages.every((page) => page.availability === "legacy_unavailable") === true;
  const occurrenceState = occurrenceEvidenceState(
    legacyUnavailable,
    traversal.isPending,
    occurrences.length,
    Boolean(selected),
  );

  const reset = (resource: string, locator?: string) =>
    void client.resetQueries({ exact: true, queryKey: resourceQueryKey(runId, resource, locator) });
  // Traversal paging belongs to the occurrence selector. Keeping it out of the
  // workflow action prevents two recovery controls from competing for one stale cursor.
  return {
    activity: {
      groups: activityGroups,
      onLoadMore: () => void activity.fetchNextPage(),
      onRetry: () => void activity.refetch(),
      onRetryPaging: () => recover(activity),
      pagination: pagingState(activity),
      state: panelState(occurrenceState, activity, activityGroups.length > 0),
    },
    artifacts: {
      artifacts: selectedArtifactItems,
      onLoadMore: () => void artifacts.fetchNextPage(),
      onRetry: () => void artifacts.refetch(),
      onRetryPaging: () => recover(artifacts),
      pagination: pagingState(artifacts),
      runArtifactCount: artifacts.data?.pages[0]?.runAggregateCount ?? 0,
      state: panelState(occurrenceState, artifacts, selectedArtifactItems.length > 0),
    },
    legacyUnavailable,
    logs: {
      entries: logEntries,
      onLoadOlder: () => void logs.fetchNextPage(),
      onRetry: () => void logs.refetch(),
      onRetryPaging: () => recover(logs),
      pagination: pagingState(logs),
      state: panelState(occurrenceState, logs, logEntries.length > 0),
    },
    occurrenceLabel: selected
      ? `${selected.stepId} · ${selected.ordinal}`
      : occurrenceState === "legacy_unavailable"
        ? "legacy run"
        : occurrenceState === "traversal_pending"
          ? "occurrence pending"
          : "selection unavailable",
    selector: {
      isError: traversal.isError && occurrences.length === 0,
      isPending: traversal.isPending,
      occurrences,
      onRetry: () => reset("traversal"),
      onRetryPaging: () => recover(traversal),
      onSelect: (ref: string) => setSelection({ ref, runId }),
      onShowEarlier: () => void traversal.fetchNextPage(),
      pagination: pagingState(traversal),
      selectedRef,
    },
    workflow: {
      definitionComplete: pageComplete(workflow),
      edges: workflowEdges,
      executionComplete: pageComplete(traversal),
      isLoading: workflow.isPending,
      nodes: workflowNodes,
      occurrences: traversalRecords,
      onLoadMore: () =>
        workflow.isError ? recover(workflow) : void workflow.fetchNextPage(),
      pagination: pagingState(workflow),
      runId,
    },
  };
}

type PageQuery = {
  error: unknown;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  refetch: () => Promise<unknown>;
};

function recover(query: PageQuery) {
  if (isStaleLocatorError(query.error)) {
    // Infinite-query refetch starts from page one and retains last-good pages
    // until the replacement chain succeeds.
    void query.refetch();
  } else {
    void query.fetchNextPage();
  }
}

function pagingState(query: PageQuery): PagingState {
  if (query.isFetchingNextPage) {
    return "loading";
  }
  if (query.isFetchNextPageError || query.isError) {
    return isStaleLocatorError(query.error) ? "stale" : "error";
  }
  return query.hasNextPage ? "more" : "complete";
}

function pageComplete(query: PageQuery): boolean {
  return !query.isPending && !query.isError && !query.hasNextPage;
}

function occurrenceEvidenceState(
  legacy: boolean,
  traversalPending: boolean,
  occurrenceCount: number,
  hasSelection: boolean,
): OccurrenceEvidenceState {
  if (legacy) {
    return "legacy_unavailable";
  }
  if (traversalPending && occurrenceCount === 0) {
    return "traversal_pending";
  }
  return hasSelection ? "ready" : "missing_selection";
}

function panelState(
  occurrenceState: OccurrenceEvidenceState,
  query: PageQuery,
  hasLastGood = false,
): OccurrenceEvidenceState {
  if (occurrenceState !== "ready") {
    return occurrenceState;
  }
  if (query.isError && !hasLastGood) {
    return "error";
  }
  return query.isPending ? "loading" : "ready";
}

function accumulateEdges(pages: ReadonlyArray<WorkflowPageDTO> | undefined) {
  return accumulatePages(
    (pages ?? []).map((page) => ({ items: page.edges })),
    (edge) => `${edge.from}->${edge.to}`,
  );
}
