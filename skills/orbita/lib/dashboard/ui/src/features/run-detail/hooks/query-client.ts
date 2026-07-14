import { DASHBOARD_SCHEMA_VERSION, PublicErrorSchema } from "@dashboard-contracts";

type Parser<T> = { parse: (value: unknown) => T };

export async function fetchDashboardResource<T>(
  url: string,
  parser: Parser<T>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  });
  if (!response.ok) {
    let code: DashboardResourceErrorCode;
    try {
      const body = PublicErrorSchema.parse(await response.json());
      code = body.error.code;
    } catch {
      code = "unknown";
    }
    throw new DashboardResourceError(response.status, code);
  }
  return parser.parse(await response.json());
}

export type DashboardResourceErrorCode =
  | "content_unavailable"
  | "invalid_request"
  | "method_not_allowed"
  | "not_found"
  | "observer_unavailable"
  | "range_not_satisfiable"
  | "stale_locator"
  | "unknown";

export class DashboardResourceError extends Error {
  constructor(
    readonly status: number,
    readonly code: DashboardResourceErrorCode = "unknown",
  ) {
    super("dashboard_resource_unavailable");
  }
}

export function isStaleLocatorError(error: unknown): boolean {
  return error instanceof DashboardResourceError && error.code === "stale_locator";
}

export function resourceQueryKey(runId: string | undefined, resource: string, locator?: string) {
  return ["dashboard", DASHBOARD_SCHEMA_VERSION, runId, resource, locator ?? null] as const;
}

export function resourceUrl(
  runId: string,
  resource: string,
  params?: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      query.set(key, value);
    }
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  return `/api/dashboard/v2/runs/${encodeURIComponent(runId)}/${resource}${suffix}`;
}
