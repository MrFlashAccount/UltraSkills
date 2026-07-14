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

const runEnabled = (runId?: string) => typeof window !== "undefined" && Boolean(runId);
const scopedEnabled = (runId?: string, locator?: string) => runEnabled(runId) && Boolean(locator);

export function useWorkflowPages(runId?: string) {
  return useInfiniteQuery<
    WorkflowPageDTO,
    Error,
    InfiniteData<WorkflowPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: runEnabled(runId),
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
    enabled: runEnabled(runId),
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

export function useActivityPages(runId?: string, stepId?: string, groupId?: string) {
  return useInfiniteQuery<
    ActivityPageDTO,
    Error,
    InfiniteData<ActivityPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: scopedEnabled(runId, stepId) && Boolean(groupId),
    getNextPageParam: (page) => (page.complete ? undefined : page.nextCursor),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchDashboardResource<ActivityPageDTO>(
        resourceUrl(runId!, "activity", { cursor: pageParam, groupId, stepId }),
        ActivityPageSchema,
        signal,
      ),
    queryKey: resourceQueryKey(runId, "activity", `${stepId ?? "none"}:${groupId ?? "none"}`),
  });
}

export function useLogPages(runId?: string, stepId?: string) {
  return useInfiniteQuery<
    LogsPageDTO,
    Error,
    InfiniteData<LogsPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: scopedEnabled(runId, stepId),
    getNextPageParam: (page) => (page.complete ? undefined : page.nextCursor),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchDashboardResource<LogsPageDTO>(
        resourceUrl(runId!, "logs", { cursor: pageParam, stepId }),
        LogsPageSchema,
        signal,
      ),
    queryKey: resourceQueryKey(runId, "logs", stepId),
  });
}

export function useWorkflowStepArtifactPages(runId?: string, stepId?: string) {
  return useInfiniteQuery<
    ArtifactPageDTO,
    Error,
    InfiniteData<ArtifactPageDTO, string | undefined>,
    ReturnType<typeof resourceQueryKey>,
    string | undefined
  >({
    enabled: scopedEnabled(runId, stepId),
    getNextPageParam: (page) => (page.complete ? undefined : page.nextCursor),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchDashboardResource<ArtifactPageDTO>(
        resourceUrl(runId!, "artifacts", {
          cursor: pageParam,
          stepId,
        }),
        ArtifactPageSchema,
        signal,
      ),
    queryKey: resourceQueryKey(runId, "artifacts:workflow-step", stepId),
  });
}
