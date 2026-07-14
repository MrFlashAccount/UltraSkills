import { RunLightDetailSchema, type RunLightDetailDTO } from "@dashboard-contracts";
import { useQuery } from "@tanstack/react-query";
import { DashboardResourceError, fetchDashboardResource, resourceQueryKey } from "./query-client";

export function useRunDetailQuery(runId?: string) {
  return useQuery<RunLightDetailDTO | null>({
    enabled: typeof window !== "undefined" && Boolean(runId),
    queryFn: async ({ signal }) => {
      try {
        return await fetchDashboardResource<RunLightDetailDTO>(
          `/api/dashboard/v2/runs/${encodeURIComponent(runId!)}`,
          RunLightDetailSchema,
          signal,
        );
      } catch (error) {
        if (error instanceof DashboardResourceError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    queryKey: resourceQueryKey(runId, "light-detail"),
    retry: 1,
  });
}
