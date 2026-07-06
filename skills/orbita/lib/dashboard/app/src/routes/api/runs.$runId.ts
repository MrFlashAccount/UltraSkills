import { createFileRoute } from '@tanstack/react-router';
import { dashboardErrorResponse, dashboardJson, dashboardRuntimeContext } from '../../dashboard-runtime';

export const Route = createFileRoute('/api/runs/$runId')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { runId: string } }) => {
        try {
          const { reader } = dashboardRuntimeContext();
          const run = await reader.getRun(params.runId);
          return dashboardJson(run ? { run } : { error: 'run not found' }, { status: run ? 200 : 404 });
        } catch (error) {
          return dashboardErrorResponse(error);
        }
      },
    },
  },
});
