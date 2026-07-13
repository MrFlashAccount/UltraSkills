import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleSnapshotRequest } from "../server/dashboard-http.server";

export const Route = createFileRoute("/api/dashboard/v1/runs")({
  server: { handlers: { GET: ({ request }) => handleSnapshotRequest(request) } },
});
