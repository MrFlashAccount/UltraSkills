import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleEventsRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v2/events")({
  server: { handlers: { GET: ({ request }) => handleEventsRequest(request) } },
});
