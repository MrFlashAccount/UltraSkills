import { useQuery } from "@tanstack/react-query";
import { RunOutputsSchema, type RunOutputsDTO } from "@dashboard-contracts";

async function fetchRunOutputs(runId: string, stepId?: string): Promise<RunOutputsDTO> {
  const search = stepId ? `?${new URLSearchParams({ step: stepId }).toString()}` : "";
  const response = await fetch(
    `/api/dashboard/v1/runs/${encodeURIComponent(runId)}/outputs${search}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error("outputs_unavailable");
  }
  return RunOutputsSchema.parse(await response.json()) as RunOutputsDTO;
}

export function useRunOutputsQuery(runId: string, enabled: boolean, stepId?: string) {
  return useQuery({
    enabled: typeof window !== "undefined" && enabled,
    queryFn: () => fetchRunOutputs(runId, stepId),
    queryKey: ["dashboard", "run", runId, "outputs", stepId ?? "all"],
    retry: 1,
  });
}
