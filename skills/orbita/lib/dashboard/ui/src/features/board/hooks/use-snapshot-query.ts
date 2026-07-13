import { useQuery } from "@tanstack/react-query";
import { PublicErrorSchema, SnapshotEnvelopeSchema } from "@dashboard-contracts";

export const snapshotQueryKey = ["dashboard", "snapshot", "v1"] as const;

async function fetchSnapshot() {
  const response = await fetch("/api/dashboard/v1/runs", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const publicError = PublicErrorSchema.safeParse(await response.json().catch(() => null));
    throw new DashboardFetchError(
      publicError.success ? publicError.data.error.code : "observer_unavailable",
    );
  }
  const snapshot = SnapshotEnvelopeSchema.parse(await response.json());
  performance.mark?.("orbita-snapshot-validated");
  return snapshot;
}

export class DashboardFetchError extends Error {
  constructor(
    readonly code: "not_found" | "method_not_allowed" | "observer_unavailable" | "invalid_request",
  ) {
    super(code);
  }
}

/** Owns validated remote snapshot state; no unvalidated response reaches components. */
export function useSnapshotQuery() {
  return useQuery({
    enabled: typeof window !== "undefined",
    queryFn: fetchSnapshot,
    queryKey: snapshotQueryKey,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
