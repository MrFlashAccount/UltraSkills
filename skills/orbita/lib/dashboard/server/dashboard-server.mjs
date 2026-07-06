import { createServer as createViteServer } from 'vite';
import dashboardViteConfig from '../app/vite.config.ts';
import {
  clearDashboardRuntimeContext,
  setDashboardRuntimeContext,
} from '../app/src/dashboard-runtime.ts';
import { DashboardEventPublisher } from './dashboard-event-publisher.mjs';
import { RunsRootObserverReader } from './runs-root-observer-reader.mjs';
import { publicErrorMessage } from '../../public-error.mjs';

function publicDashboardErrorMessage(error, { runsRoot } = {}) {
  const message = error?.message ?? String(error);
  return publicErrorMessage(message, { runsRoot });
}

function dashboardUrl(host, address) {
  if (!address || typeof address === 'string') return `http://${host}:0`;
  return `http://${host}:${address.port}`;
}

export async function startDashboardServer({ runsRoot, host = '127.0.0.1', port = 0, pollMs = 1000 } = {}) {
  const observer = new RunsRootObserverReader({ runsRoot });
  const publisher = new DashboardEventPublisher({
    snapshot: () => observer.listRuns(),
    pollMs,
    watchPath: runsRoot,
    errorMessage: (error) => publicDashboardErrorMessage(error, { runsRoot: observer.runsRoot }),
  });
  publisher.start();
  setDashboardRuntimeContext({
    reader: observer,
    publisher,
    errorMessage: (error) => publicDashboardErrorMessage(error, { runsRoot: observer.runsRoot }),
  });

  const vite = await createViteServer({
    ...dashboardViteConfig,
    logLevel: 'silent',
    clearScreen: false,
    server: {
      ...dashboardViteConfig.server,
      host,
      port,
      strictPort: false,
    },
  });
  await vite.listen();

  return {
    server: vite.httpServer,
    publisher,
    url: dashboardUrl(host, vite.httpServer?.address()),
    close: async () => {
      publisher.close();
      clearDashboardRuntimeContext();
      await vite.close();
    },
  };
}
