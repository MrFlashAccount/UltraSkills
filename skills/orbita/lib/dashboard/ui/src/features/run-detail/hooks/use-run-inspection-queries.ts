import {
  ActivityPageSchema,
  type ActivityPageDTO,
  ArtifactPageSchema,
  type ArtifactPageDTO,
  LogsPageSchema,
  type LogsPageDTO,
  TraversalPageSchema,
  type TraversalPageDTO,
  WorkflowPageSchema,
  type WorkflowPageDTO,
} from "@dashboard-contracts";
import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { fetchDashboardResource, resourceQueryKey, resourceUrl } from "./query-client";

const enabled = (runId?: string, locator?: string) =>
  typeof window !== "undefined" && Boolean(runId) && (locator === undefined || Boolean(locator));

export function useWorkflowPages(runId?: string) {
  return useInfiniteQuery<
    WorkflowPageDTO,
    Error,
    InfiniteData<WorkflowPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: enabled(runId),
    getNextPageParam: (page) => (page.complete ? undefined : page.nextCursor),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchDashboardResource<WorkflowPageDTO>(
        resourceUrl(runId!, "workflow", { cursor: pageParam }),
        WorkflowPageSchema,
        signal,
      ),
    queryKey: resourceQueryKey(runId, "workflow"),
  });
}

export function useTraversalPages(runId?: string) {
  return useInfiniteQuery<
    TraversalPageDTO,
    Error,
    InfiniteData<TraversalPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: enabled(runId),
    getNextPageParam: (page) => (page.complete ? undefined : page.nextCursor),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchDashboardResource<TraversalPageDTO>(
        resourceUrl(runId!, "traversal", { cursor: pageParam }),
        TraversalPageSchema,
        signal,
      ),
    queryKey: resourceQueryKey(runId, "traversal"),
  });
}

export function useActivityPages(runId?: string, occurrenceRef?: string) {
  return useInfiniteQuery<
    ActivityPageDTO,
    Error,
    InfiniteData<ActivityPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: enabled(runId, occurrenceRef),
    getNextPageParam: (page) => (page.complete ? undefined : page.nextCursor),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchDashboardResource<ActivityPageDTO>(
        resourceUrl(runId!, "activity", { cursor: pageParam, occurrenceRef }),
        ActivityPageSchema,
        signal,
      ),
    queryKey: resourceQueryKey(runId, "activity", occurrenceRef),
  });
}

export function useLogPages(runId?: string, occurrenceRef?: string) {
  return useInfiniteQuery<
    LogsPageDTO,
    Error,
    InfiniteData<LogsPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: enabled(runId, occurrenceRef),
    getNextPageParam: (page) => (page.complete ? undefined : page.nextCursor),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchDashboardResource<LogsPageDTO>(
        resourceUrl(runId!, "logs", { cursor: pageParam, occurrenceRef }),
        LogsPageSchema,
        signal,
      ),
    queryKey: resourceQueryKey(runId, "logs", occurrenceRef),
  });
}

export function useOccurrenceArtifactPages(runId?: string, occurrenceRef?: string) {
  return useArtifactPages(runId, "occurrence", occurrenceRef);
}

export function useWorkflowStepArtifactPages(runId?: string, stepId?: string) {
  return useArtifactPages(runId, "workflow-step", stepId);
}

function useArtifactPages(
  runId: string | undefined,
  scope: "occurrence" | "workflow-step",
  locator: string | undefined,
) {
  return useInfiniteQuery<
    ArtifactPageDTO,
    Error,
    InfiniteData<ArtifactPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: enabled(runId, locator),
    getNextPageParam: (page) => (page.complete ? undefined : page.nextCursor),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchDashboardResource<ArtifactPageDTO>(
        resourceUrl(runId!, "artifacts", {
          cursor: pageParam,
          occurrenceRef: scope === "occurrence" ? locator : undefined,
          stepId: scope === "workflow-step" ? locator : undefined,
        }),
        ArtifactPageSchema,
        signal,
      ),
    queryKey: resourceQueryKey(runId, `artifacts:${scope}`, locator),
  });
}
