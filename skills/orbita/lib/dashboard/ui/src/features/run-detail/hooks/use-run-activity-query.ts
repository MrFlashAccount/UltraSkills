import { useInfiniteQuery } from "@tanstack/react-query";
import { RunActivityPageSchema, type RunActivityPageDTO } from "@dashboard-contracts";

async function fetchRunActivity(
  runId: string,
  cursor?: string,
  stepId?: string,
): Promise<RunActivityPageDTO> {
  const search = new URLSearchParams();
  if (cursor) {
    search.set("cursor", cursor);
  }
  if (stepId) {
    search.set("step", stepId);
  }
  const suffix = search.size ? `?${search.toString()}` : "";
  const response = await fetch(
    `/api/dashboard/v1/runs/${encodeURIComponent(runId)}/activity${suffix}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error("activity_unavailable");
  }
  return RunActivityPageSchema.parse(await response.json()) as RunActivityPageDTO;
}

export function useRunActivityQuery(runId: string, enabled: boolean, stepId?: string) {
  return useInfiniteQuery<RunActivityPageDTO, Error>({
    enabled: typeof window !== "undefined" && enabled,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchRunActivity(runId, typeof pageParam === "string" ? pageParam : undefined, stepId),
    queryKey: ["dashboard", "run", runId, "activity", stepId ?? "all"],
    retry: 1,
  });
}
