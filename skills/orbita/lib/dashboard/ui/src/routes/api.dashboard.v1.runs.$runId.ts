import { createFileRoute } from '@tanstack/react-router';
import type {} from '@tanstack/react-start';
import { handleDetailRequest } from '../server/dashboard-http.server';

export const Route = createFileRoute('/api/dashboard/v1/runs/$runId')({
  server: {
    handlers: { GET: ({ request, params }) => handleDetailRequest(request, params.runId) },
  },
});
