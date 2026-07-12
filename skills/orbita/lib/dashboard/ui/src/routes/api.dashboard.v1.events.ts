import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleEventsRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v1/events")({
  server: { handlers: { GET: ({ request }) => handleEventsRequest(request) } },
});
