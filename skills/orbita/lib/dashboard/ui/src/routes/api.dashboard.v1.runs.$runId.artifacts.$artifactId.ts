import { createFileRoute } from "@tanstack/react-router";
import { handleArtifactRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v1/runs/$runId/artifacts/$artifactId")({
  server: {
    handlers: {
      GET: ({ params, request }) => handleArtifactRequest(request, params.runId, params.artifactId),
    },
  },
});
