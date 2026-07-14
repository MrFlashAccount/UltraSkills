import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleLightDetailRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v2/runs/$runId")({
  server: {
    handlers: { GET: ({ params, request }) => handleLightDetailRequest(request, params.runId) },
  },
});
