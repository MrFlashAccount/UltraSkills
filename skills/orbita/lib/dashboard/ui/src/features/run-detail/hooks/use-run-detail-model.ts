import type { RunLightDetailDTO, WorkflowPageDTO } from "@dashboard-contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type StepEvidenceState } from "../run-detail-view-model";
import {
  accumulatePages,
  mergeTraversalPages,
  toActivityGroupDescriptors,
  toManagedLogEntries,
  toRunArtifactItems,
  toStepPathItems,
} from "../selectors/page-selectors";
import { resourceQueryKey } from "./query-client";
import { type PagingQuery, usePagingRecovery } from "./use-paging-recovery";
import {
  useLogPages,
  useTraversalPages,
  useWorkflowPages,
  useWorkflowStepArtifactPages,
} from "./use-run-inspection-queries";

/** Owns run-scoped query and selection state; no identity survives a run-id transition. */
export function useRunDetailModel(detail: RunLightDetailDTO) {
  const runId = detail.run.runId;
  const client = useQueryClient();
  const paging = usePagingRecovery();
  const workflow = useWorkflowPages(runId);
  const traversal = useTraversalPages(runId);
  const currentStepId = detail.run.currentStep;
  const steps = toStepPathItems(traversal.data?.pages, currentStepId);
  const [selection, setSelection] = useState<{ runId: string; stepId: string }>();
  const explicitSelection = selection?.runId === runId ? selection.stepId : undefined;
  const selectedStepId =
    explicitSelection ??
    currentStepId ??
    steps.find((step) => step.state === "current")?.stepId ??
    steps.at(-1)?.stepId;
  const logs = useLogPages(runId, selectedStepId);
  const artifacts = useWorkflowStepArtifactPages(runId, selectedStepId);
  const traversalRecords = mergeTraversalPages(traversal.data?.pages);
  const selectedRecord = traversalRecords.find((step) => step.stepId === selectedStepId);
  const workflowNodes = accumulatePages(
    workflow.data?.pages.map((page) => ({ items: page.nodes })),
    (node) => node.stepId,
  );
  const workflowEdges = accumulateEdges(workflow.data?.pages);
  const selectedArtifactItems = toRunArtifactItems(runId, artifacts.data?.pages);
  const activityGroups = toActivityGroupDescriptors(selectedRecord);
  const logEntries = toManagedLogEntries(logs.data?.pages);
  const evidenceState = stepEvidenceState(
    traversal.isPending,
    traversalRecords.length,
    Boolean(selectedStepId),
  );
  const artifactsKey = `artifacts:${selectedStepId ?? "none"}`;
  const logsKey = `logs:${selectedStepId ?? "none"}`;

  const reset = (resource: string, locator?: string) =>
    void client.resetQueries({ exact: true, queryKey: resourceQueryKey(runId, resource, locator) });
  // Traversal paging belongs to the step-path selector. Keeping it out of the
  // workflow action prevents two recovery controls from competing for one stale cursor.
  return {
    activity: {
      groups: activityGroups,
      runId,
      state: evidenceState,
      step: selectedRecord,
      stepId: selectedStepId,
    },
    artifacts: {
      artifacts: selectedArtifactItems,
      onLoadMore: () => paging.loadNext(artifactsKey, artifacts),
      onRetry: () => paging.refetch(artifactsKey, artifacts),
      onRetryPaging: () => paging.recover(artifactsKey, artifacts),
      pagination: paging.state(artifactsKey, artifacts),
      runArtifactCount: artifacts.data?.pages[0]?.runAggregateCount ?? 0,
      state: panelState(evidenceState, artifacts, selectedArtifactItems.length > 0),
    },
    logs: {
      entries: logEntries,
      onLoadOlder: () => paging.loadNext(logsKey, logs),
      onRetry: () => paging.refetch(logsKey, logs),
      onRetryPaging: () => paging.recover(logsKey, logs),
      pagination: paging.state(logsKey, logs),
      state: panelState(evidenceState, logs, logEntries.length > 0),
    },
    stepLabel: selectedStepId
      ? selectedStepId
      : evidenceState === "traversal_pending"
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
      traversedSteps: traversalRecords,
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

function stepEvidenceState(
  traversalPending: boolean,
  stepCount: number,
  hasSelection: boolean,
): StepEvidenceState {
  if (traversalPending && stepCount === 0) {
    return "traversal_pending";
  }
  return hasSelection ? "ready" : "missing_selection";
}

function panelState(
  evidenceState: StepEvidenceState,
  query: PagingQuery,
  hasLastGood = false,
): StepEvidenceState {
  if (evidenceState !== "ready") {
    return evidenceState;
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
