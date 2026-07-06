import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { DashboardEventPublisher } from './dashboard-event-publisher.mjs';
import { RunsRootObserverReader } from './runs-root-observer-reader.mjs';
import { publicErrorMessage } from '../../public-error.mjs';

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
};
const dashboardStaticRoot = join(dirname(fileURLToPath(import.meta.url)), '../ui/dist');
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

function isPathUnderRoot(rootPath, candidatePath) {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function staticAssetFilePath({ pathname, staticRoot }) {
  if (!pathname.startsWith('/dashboard/')) return undefined;
  const relativePath = decodeURIComponent(pathname.slice('/dashboard/'.length));
  const segments = relativePath.split('/');
  if (!relativePath || relativePath.endsWith('.map') || segments.some((segment) => segment.startsWith('.'))) return undefined;
  const rootPath = resolve(staticRoot);
  const filePath = resolve(rootPath, relativePath);
  return isPathUnderRoot(rootPath, filePath) ? filePath : undefined;
}

function staticRootIndexPath(staticRoot) {
  return resolve(staticRoot, 'index.html');
}

async function readStaticFile(filePath, { runsRoot, staticRoot }) {
  try {
    return { ok: true, content: await readFile(filePath) };
  } catch (error) {
    return {
      ok: false,
      statusCode: error?.code === 'ENOENT' ? 404 : 500,
      error: error?.code === 'ENOENT'
        ? 'static asset not found'
        : publicDashboardErrorMessage(error, { runsRoot, staticRoot }),
    };
  }
}

export function createDashboardRequestHandler({ observer, publisher, staticRoot } = {}) {
  const reader = observer ?? new RunsRootObserverReader();
  const resolvedStaticRoot = staticRoot ?? dashboardStaticRoot;
  const errorMessage = (error) => publicDashboardErrorMessage(error, { runsRoot: reader.runsRoot, staticRoot: resolvedStaticRoot });
  const events = publisher ?? new DashboardEventPublisher({ snapshot: () => reader.listRuns(), errorMessage });
  events.start();

  return async function dashboardRequestHandler(request, response) {
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
        const appShell = await readStaticFile(staticRootIndexPath(resolvedStaticRoot), {
          runsRoot: reader.runsRoot,
          staticRoot: resolvedStaticRoot,
        });
        if (appShell.ok) {
          sendText(response, 200, appShell.content, STATIC_TYPES['.html']);
          return;
        }
        sendJson(response, appShell.statusCode, { error: appShell.error });
        return;
      }
      const staticPath = request.method === 'GET'
        ? staticAssetFilePath({ pathname: url.pathname, staticRoot: resolvedStaticRoot })
        : undefined;
      if (staticPath !== undefined) {
        const asset = await readStaticFile(staticPath, {
          runsRoot: reader.runsRoot,
          staticRoot: resolvedStaticRoot,
        });
        if (!asset.ok) {
          sendJson(response, asset.statusCode, { error: asset.error });
          return;
        }
        sendText(response, 200, asset.content, STATIC_TYPES[extname(url.pathname)] ?? 'application/octet-stream');
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
  const resolvedStaticRoot = staticRoot ?? dashboardStaticRoot;
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
