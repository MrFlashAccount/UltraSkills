import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleLogsRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v2/runs/$runId/logs")({
  server: { handlers: { GET: ({ params, request }) => handleLogsRequest(request, params.runId) } },
});
