import { createServer } from 'node:http';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { renderDashboardShell } from '../ui/render.mjs';
import { DashboardEventPublisher } from './dashboard-event-publisher.mjs';
import { RunsRootObserverReader } from './runs-root-observer-reader.mjs';
import { publicErrorMessage } from '../../public-error.mjs';
import {
  dashboardIndexFile,
  dashboardSourceUiRoot,
  dashboardStaticContentType,
  resolveDashboardStaticFile,
  resolveDashboardStaticRoot,
} from './dashboard-static-assets.mjs';

const API_LIST_PATHS = new Set(['/api/runs', '/api/dashboard/runs']);
const API_EVENTS_PATHS = new Set(['/api/events', '/api/dashboard/events']);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendText(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, { 'content-type': contentType });
  response.end(body);
}

function sseFrame(event) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function publicDashboardErrorMessage(error, { runsRoot, staticRoot } = {}) {
  const message = error?.message ?? String(error);
  return publicErrorMessage(publicErrorMessage(message, { runsRoot }), { runsRoot: staticRoot });
}

function dashboardDetailRunId(pathname) {
  for (const prefix of ['/api/runs/', '/api/dashboard/runs/']) {
    if (pathname.startsWith(prefix)) return decodeURIComponent(pathname.slice(prefix.length));
  }
  return undefined;
}

async function readDashboardAppShell({ staticRoot, useStaticIndex }) {
  if (!useStaticIndex) return renderDashboardShell({ runs: [] });
  try {
    return await readFile(join(staticRoot, dashboardIndexFile), 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return renderDashboardShell({ runs: [] });
  }
}

export function createDashboardRequestHandler({ observer, publisher, staticRoot } = {}) {
  const reader = observer ?? new RunsRootObserverReader();
  const resolvedStaticRoot = resolveDashboardStaticRoot(staticRoot);
  const useStaticIndex = staticRoot !== undefined || resolvedStaticRoot !== dashboardSourceUiRoot;
  const errorMessage = (error) => publicDashboardErrorMessage(error, { runsRoot: reader.runsRoot, staticRoot: resolvedStaticRoot });
  const events = publisher ?? new DashboardEventPublisher({ snapshot: () => reader.listRuns(), errorMessage });
  events.start();

  return async function dashboardRequestHandler(request, response) {
    const rawPathname = request.url.split(/[?#]/, 1)[0] ?? '';
    const url = new URL(request.url, 'http://127.0.0.1');
    try {
      if (request.method === 'GET' && API_LIST_PATHS.has(url.pathname)) {
        sendJson(response, 200, { runs: await reader.listRuns() });
        return;
      }
      const detailRunId = request.method === 'GET' ? dashboardDetailRunId(url.pathname) : undefined;
      if (detailRunId !== undefined) {
        const runId = detailRunId;
        const run = await reader.getRun(runId);
        sendJson(response, run ? 200 : 404, run ? { run } : { error: 'run not found' });
        return;
      }
      if (request.method === 'GET' && API_EVENTS_PATHS.has(url.pathname)) {
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        const unsubscribe = events.subscribe((event) => {
          response.write(sseFrame(event));
        });
        request.on('close', unsubscribe);
        events.refresh().catch((error) => events.publishError(error));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/') {
        sendText(
          response,
          200,
          await readDashboardAppShell({ staticRoot: resolvedStaticRoot, useStaticIndex }),
          dashboardStaticContentType(dashboardIndexFile),
        );
        return;
      }
      const staticFile = request.method === 'GET'
        ? resolveDashboardStaticFile({ staticRoot: resolvedStaticRoot, pathname: rawPathname })
        : undefined;
      if (staticFile !== undefined) {
        let content;
        try { content = await readFile(staticFile); }
        catch (error) {
          sendJson(response, error?.code === 'ENOENT' ? 404 : 500, {
            error: error?.code === 'ENOENT'
              ? 'static asset not found'
              : publicDashboardErrorMessage(error, { runsRoot: reader.runsRoot, staticRoot: resolvedStaticRoot }),
          });
          return;
        }
        sendText(response, 200, content, dashboardStaticContentType(url.pathname));
        return;
      }
      sendJson(response, 404, { error: 'not found' });
    } catch (error) {
      sendJson(response, 500, { error: publicDashboardErrorMessage(error, { runsRoot: reader.runsRoot, staticRoot: resolvedStaticRoot }) });
    }
  };
}

export function startDashboardServer({ runsRoot, host = '127.0.0.1', port = 0, pollMs = 1000, staticRoot } = {}) {
  const observer = new RunsRootObserverReader({ runsRoot });
  const resolvedStaticRoot = resolveDashboardStaticRoot(staticRoot);
  const publisher = new DashboardEventPublisher({
    snapshot: () => observer.listRuns(),
    pollMs,
    watchPath: runsRoot,
    errorMessage: (error) => publicDashboardErrorMessage(error, { runsRoot: observer.runsRoot, staticRoot: resolvedStaticRoot }),
  });
  const server = createServer(createDashboardRequestHandler({ observer, publisher, staticRoot }));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve({
        server,
        publisher,
        url: `http://${host}:${server.address().port}`,
        close: () => new Promise((done) => {
          publisher.close();
          server.close(done);
        }),
      });
    });
  });
}
