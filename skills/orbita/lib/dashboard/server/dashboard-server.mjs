import { createServer } from 'node:http';
import { constants } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstat, open, realpath } from 'node:fs/promises';
import { renderDashboardShell } from '../ui/render.mjs';
import { DashboardEventPublisher } from './dashboard-event-publisher.mjs';
import { RunsRootObserverReader } from './runs-root-observer-reader.mjs';
import { publicErrorMessage } from '../../public-error.mjs';

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
const dashboardUiRoot = join(dirname(fileURLToPath(import.meta.url)), '../ui');
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

function staticAssetPath(pathname) {
  if (!pathname.startsWith('/dashboard/') || pathname.includes('..')) return undefined;
  const relativePath = pathname.slice('/dashboard/'.length);
  if (!relativePath || relativePath.includes('/')) return undefined;
  return relativePath;
}

function isContainedPath(root, candidate) {
  const relation = relative(root, candidate);
  return relation !== '' && relation !== '..' && !relation.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(relation);
}

async function readStaticAsset(staticRootPromise, assetName) {
  const canonicalRoot = await staticRootPromise;
  if (canonicalRoot instanceof Error) throw canonicalRoot;
  const candidate = resolve(canonicalRoot, assetName);
  if (!isContainedPath(canonicalRoot, candidate)) {
    const error = new Error('static asset is outside the dashboard root');
    error.code = 'ENOENT';
    throw error;
  }
  const canonicalCandidate = await realpath(candidate);
  if (!isContainedPath(canonicalRoot, canonicalCandidate)) {
    const error = new Error('static asset resolves outside the dashboard root');
    error.code = 'ENOENT';
    throw error;
  }
  const linkStats = await lstat(candidate);
  if (linkStats.isSymbolicLink() || !linkStats.isFile()) {
    const error = new Error('static asset is not a regular file');
    error.code = 'ENOENT';
    throw error;
  }
  const handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const fileStats = await handle.stat();
    if (!fileStats.isFile()) {
      const error = new Error('static asset is not a regular file');
      error.code = 'ENOENT';
      throw error;
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function createSseClient(request, response, events, clients) {
  let blocked = false;
  let pendingFrame;
  let ended = false;
  let unsubscribe = () => {};

  const cleanup = () => {
    if (ended) return;
    ended = true;
    pendingFrame = undefined;
    unsubscribe();
    response.off('drain', drain);
    clients.delete(client);
  };
  const write = (frame) => {
    if (ended) return;
    if (blocked) {
      pendingFrame = frame;
      return;
    }
    blocked = !response.write(frame);
  };
  const drain = () => {
    if (ended) return;
    blocked = false;
    if (pendingFrame === undefined) return;
    const latest = pendingFrame;
    pendingFrame = undefined;
    write(latest);
  };
  const client = {
    response,
    close() {
      if (ended) return;
      response.end();
    },
    destroy() {
      response.destroy();
      cleanup();
    },
  };
  clients.add(client);
  response.on('drain', drain);
  request.once('close', cleanup);
  response.once('close', cleanup);
  unsubscribe = events.subscribe((event) => write(sseFrame(event)));
  return client;
}

export function createDashboardRequestHandler({ observer, publisher, staticRoot } = {}) {
  const reader = observer ?? new RunsRootObserverReader();
  const resolvedStaticRoot = staticRoot ?? dashboardUiRoot;
  const staticRootPromise = realpath(resolvedStaticRoot).catch((error) => error);
  const sseClients = new Set();
  const errorMessage = (error) => publicDashboardErrorMessage(error, { runsRoot: reader.runsRoot, staticRoot: resolvedStaticRoot });
  const events = publisher ?? new DashboardEventPublisher({ snapshot: () => reader.listRuns(), errorMessage });
  events.start();

  const handler = async function dashboardRequestHandler(request, response) {
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
        createSseClient(request, response, events, sseClients);
        events.refresh().catch((error) => events.publishError(error));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/') {
        sendText(response, 200, renderDashboardShell({ runs: [] }), STATIC_TYPES['.html']);
        return;
      }
      const staticPath = request.method === 'GET' ? staticAssetPath(url.pathname) : undefined;
      if (staticPath !== undefined) {
        let content;
        try { content = await readStaticAsset(staticRootPromise, staticPath); }
        catch (error) {
          sendJson(response, error?.code === 'ENOENT' ? 404 : 500, {
            error: error?.code === 'ENOENT'
              ? 'static asset not found'
              : publicDashboardErrorMessage(error, { runsRoot: reader.runsRoot, staticRoot: resolvedStaticRoot }),
          });
          return;
        }
        sendText(response, 200, content, STATIC_TYPES[extname(url.pathname)] ?? 'application/octet-stream');
        return;
      }
      sendJson(response, 404, { error: 'not found' });
    } catch (error) {
      sendJson(response, 500, { error: publicDashboardErrorMessage(error, { runsRoot: reader.runsRoot, staticRoot: resolvedStaticRoot }) });
    }
  };
  handler.closeSseClients = () => {
    for (const client of sseClients) client.close();
  };
  handler.forceCloseSseClients = () => {
    for (const client of sseClients) client.destroy();
  };
  handler.sseClientCount = () => sseClients.size;
  return handler;
}

export function startDashboardServer({ runsRoot, host = '127.0.0.1', port = 0, pollMs = 1000, staticRoot } = {}) {
  const observer = new RunsRootObserverReader({ runsRoot });
  const resolvedStaticRoot = staticRoot ?? dashboardUiRoot;
  const publisher = new DashboardEventPublisher({
    snapshot: () => observer.listRuns(),
    pollMs,
    watchPath: runsRoot,
    errorMessage: (error) => publicDashboardErrorMessage(error, { runsRoot: observer.runsRoot, staticRoot: resolvedStaticRoot }),
  });
  const handler = createDashboardRequestHandler({ observer, publisher, staticRoot });
  const server = createServer(handler);
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
          handler.closeSseClients();
          let settled = false;
          let forceTimer;
          const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(forceTimer);
            done();
          };
          forceTimer = setTimeout(() => {
            handler.forceCloseSseClients();
            server.closeAllConnections?.();
            finish();
          }, 500);
          server.close(finish);
        }),
      });
    });
  });
}
