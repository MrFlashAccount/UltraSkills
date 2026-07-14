import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleWorkflowRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v2/runs/$runId/workflow")({
  server: {
    handlers: { GET: ({ params, request }) => handleWorkflowRequest(request, params.runId) },
  },
});
