import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleTraversalRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v2/runs/$runId/traversal")({
  server: {
    handlers: { GET: ({ params, request }) => handleTraversalRequest(request, params.runId) },
  },
});
