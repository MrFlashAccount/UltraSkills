import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleArtifactsRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v2/runs/$runId/artifacts")({
  server: {
    handlers: { GET: ({ params, request }) => handleArtifactsRequest(request, params.runId) },
  },
});
