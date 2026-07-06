import { createFileRoute } from '@tanstack/react-router';
import { dashboardErrorResponse, dashboardRuntimeContext } from '../../dashboard-runtime';

function sseFrame(event: { type: string; data: unknown }) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

type DashboardSseEvent = {
  type: string;
  data: unknown;
};

export const Route = createFileRoute('/api/events')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { publisher } = dashboardRuntimeContext();
          const encoder = new TextEncoder();
          let unsubscribe = () => {};
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              unsubscribe = publisher.subscribe((event: DashboardSseEvent) => {
                controller.enqueue(encoder.encode(sseFrame(event)));
              });
              publisher.refresh().catch((error) => publisher.publishError(error));
            },
            cancel() {
              unsubscribe();
            },
          });
          return new Response(stream, {
            headers: {
              'content-type': 'text/event-stream; charset=utf-8',
              'cache-control': 'no-cache',
              connection: 'keep-alive',
            },
          });
        } catch (error) {
          return dashboardErrorResponse(error);
        }
      },
    },
  },
});
