import type { RunLightDetailDTO, WorkflowPageDTO } from "@dashboard-contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type OccurrenceEvidenceState } from "../run-detail-view-model";
import {
  accumulatePages,
  mergeTraversalPages,
  selectOccurrenceForStep,
  toActivityGroups,
  toManagedLogEntries,
  toOccurrenceItems,
  toRunArtifactItems,
  toStepPathItems,
} from "../selectors/page-selectors";
import { resourceQueryKey } from "./query-client";
import { type PagingQuery, usePagingRecovery } from "./use-paging-recovery";
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
  const paging = usePagingRecovery();
  const workflow = useWorkflowPages(runId);
  const traversal = useTraversalPages(runId);
  const occurrences = toOccurrenceItems(traversal.data?.pages);
  const currentStepId = detail.currentOccurrence?.stepId ?? detail.run.currentStep;
  const steps = toStepPathItems(traversal.data?.pages, currentStepId);
  const [selection, setSelection] = useState<{ runId: string; stepId: string }>();
  const explicitSelection = selection?.runId === runId ? selection.stepId : undefined;
  const selectedStepId =
    explicitSelection ??
    currentStepId ??
    steps.find((step) => step.state === "current")?.stepId ??
    steps.at(-1)?.stepId;
  const selected = selectOccurrenceForStep(occurrences, selectedStepId);
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
  const activityKey = `activity:${selectedRef ?? "none"}`;
  const artifactsKey = `artifacts:${selectedRef ?? "none"}`;
  const logsKey = `logs:${selectedRef ?? "none"}`;

  const reset = (resource: string, locator?: string) =>
    void client.resetQueries({ exact: true, queryKey: resourceQueryKey(runId, resource, locator) });
  // Traversal paging belongs to the step-path selector. Keeping it out of the
  // workflow action prevents two recovery controls from competing for one stale cursor.
  return {
    activity: {
      groups: activityGroups,
      onLoadMore: () => paging.loadNext(activityKey, activity),
      onRetry: () => paging.refetch(activityKey, activity),
      onRetryPaging: () => paging.recover(activityKey, activity),
      pagination: paging.state(activityKey, activity),
      state: panelState(occurrenceState, activity, activityGroups.length > 0),
    },
    artifacts: {
      artifacts: selectedArtifactItems,
      onLoadMore: () => paging.loadNext(artifactsKey, artifacts),
      onRetry: () => paging.refetch(artifactsKey, artifacts),
      onRetryPaging: () => paging.recover(artifactsKey, artifacts),
      pagination: paging.state(artifactsKey, artifacts),
      runArtifactCount: artifacts.data?.pages[0]?.runAggregateCount ?? 0,
      state: panelState(occurrenceState, artifacts, selectedArtifactItems.length > 0),
    },
    legacyUnavailable,
    logs: {
      entries: logEntries,
      onLoadOlder: () => paging.loadNext(logsKey, logs),
      onRetry: () => paging.refetch(logsKey, logs),
      onRetryPaging: () => paging.recover(logsKey, logs),
      pagination: paging.state(logsKey, logs),
      state: panelState(occurrenceState, logs, logEntries.length > 0),
    },
    stepLabel: selectedStepId
      ? selectedStepId
      : occurrenceState === "legacy_unavailable"
        ? "legacy run"
        : occurrenceState === "traversal_pending"
          ? "step pending"
          : "selection unavailable",
    selector: {
      isError: traversal.isError && steps.length === 0,
      isPending: traversal.isPending,
      steps,
      onRetry: () => reset("traversal"),
      onRetryPaging: () => paging.recover("traversal", traversal),
      onSelect: (stepId: string) => setSelection({ runId, stepId }),
      onShowEarlier: () => paging.loadNext("traversal", traversal),
      pagination: paging.state("traversal", traversal),
      selectedStepId,
    },
    workflow: {
      definitionComplete: pageComplete(workflow, paging.state("workflow", workflow)),
      edges: workflowEdges,
      executionComplete: pageComplete(traversal, paging.state("traversal", traversal)),
      isLoading: workflow.isPending,
      nodes: workflowNodes,
      occurrences: traversalRecords,
      onLoadMore: () =>
        ["error", "stale"].includes(paging.state("workflow", workflow))
          ? paging.recover("workflow", workflow)
          : paging.loadNext("workflow", workflow),
      pagination: paging.state("workflow", workflow),
      runId,
    },
  };
}

function pageComplete(query: PagingQuery, pagination: string): boolean {
  return pagination === "complete" && !query.isPending && !query.isError;
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
  query: PagingQuery,
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
