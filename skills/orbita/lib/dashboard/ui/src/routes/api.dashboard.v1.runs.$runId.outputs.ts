import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleOutputsRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v1/runs/$runId/outputs")({
  server: {
    handlers: { GET: ({ params, request }) => handleOutputsRequest(request, params.runId) },
  },
});
