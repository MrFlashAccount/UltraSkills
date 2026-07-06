import { createFileRoute } from '@tanstack/react-router';
import { dashboardErrorResponse, dashboardJson, dashboardRuntimeContext } from '../../dashboard-runtime';

export const Route = createFileRoute('/api/runs')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { reader } = dashboardRuntimeContext();
          return dashboardJson({ runs: await reader.listRuns() });
        } catch (error) {
          return dashboardErrorResponse(error);
        }
      },
    },
  },
});
