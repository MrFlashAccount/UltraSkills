import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleActivityRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v2/runs/$runId/activity")({
  server: {
    handlers: { GET: ({ params, request }) => handleActivityRequest(request, params.runId) },
  },
});
