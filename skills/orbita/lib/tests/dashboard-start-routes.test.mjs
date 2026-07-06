import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { startDashboardServer } from '../dashboard/server/dashboard-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const tempRoots = [];

afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

async function makeEmptyRunsRoot(label) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), `orbita-dashboard-start-${label}-`));
  tempRoots.push(tempRoot);
  const runsRoot = path.join(tempRoot, 'runs');
  await mkdir(runsRoot, { recursive: true });
  return runsRoot;
}

test('dashboard source defines real TanStack Start route files without a bridge adapter', () => {
  const routeTree = readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/src/routeTree.gen.ts'), 'utf8');
  const serverSource = readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/src/server.tsx'), 'utf8');
  const runtimeSource = readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/src/dashboard-runtime.ts'), 'utf8');

  assert.match(routeTree, /\/api\/runs/);
  assert.match(routeTree, /\/api\/events/);
  assert.match(routeTree, /\/api\/runs\/\$runId/);
  assert.doesNotMatch(routeTree, /\/api\/dashboard/);
  assert.match(serverSource, /createStartHandler/);
  assert.match(serverSource, /defaultStreamHandler/);
  assert.match(runtimeSource, /setDashboardRuntimeContext/);
  assert.throws(() => readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/server-routes.ts'), 'utf8'));
});

test('dashboard Start server serves app routes and canonical API routes only', async () => {
  const runsRoot = await makeEmptyRunsRoot('canonical');
  const dashboard = await startDashboardServer({ runsRoot, pollMs: 25 });
  try {
    for (const pathname of ['/', '/dashboard']) {
      const response = await fetch(`${dashboard.url}${pathname}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /text\/html/);
      assert.match(await response.text(), /Orbita Dashboard/);
    }

    const listResponse = await fetch(`${dashboard.url}/api/runs`);
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), { runs: [] });

    const aliasResponse = await fetch(`${dashboard.url}/api/dashboard/runs`);
    assert.equal(aliasResponse.status, 404);
  } finally {
    await dashboard.close();
  }
});

test('dashboard package scripts and Start config are present for backend-owned tooling', () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.equal(packageJson.scripts['dashboard:dev'], 'vite dev --config skills/orbita/lib/dashboard/app/vite.config.ts');
  assert.equal(packageJson.scripts['dashboard:build'], 'vite build --config skills/orbita/lib/dashboard/app/vite.config.ts');
  assert.equal(packageJson.scripts['dashboard:typecheck'], 'tsc -p skills/orbita/lib/dashboard/app/tsconfig.json --noEmit');
  assert.match(readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/vite.config.ts'), 'utf8'), /tanstackStart\(\)/);
  assert.match(readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/tsconfig.json'), 'utf8'), /react-jsx/);
  assert.match(readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/css-modules.d.ts'), 'utf8'), /\*\.module\.css/);
});
