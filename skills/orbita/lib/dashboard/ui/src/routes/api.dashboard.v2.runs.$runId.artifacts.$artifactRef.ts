import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleArtifactContentRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v2/runs/$runId/artifacts/$artifactRef")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        handleArtifactContentRequest(request, params.runId, params.artifactRef),
    },
  },
});
