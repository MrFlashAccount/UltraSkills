import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Static asset helpers keep dashboard serving read-only and path-safe while
// allowing the frontend build to switch from source files to hashed assets.
export const dashboardSourceUiRoot = join(dirname(fileURLToPath(import.meta.url)), '../ui');
export const dashboardBuiltUiRoot = join(dashboardSourceUiRoot, 'dist');
export const dashboardIndexFile = 'index.html';

export const DASHBOARD_STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

export function resolveDashboardStaticRoot(staticRoot) {
  if (staticRoot) return staticRoot;
  return existsSync(join(dashboardBuiltUiRoot, dashboardIndexFile))
    ? dashboardBuiltUiRoot
    : dashboardSourceUiRoot;
}

export function dashboardStaticContentType(pathname) {
  return DASHBOARD_STATIC_TYPES[extname(pathname)] ?? 'application/octet-stream';
}

export function dashboardStaticRelativePath(pathname) {
  if (!pathname.startsWith('/dashboard/')) return undefined;
  const encodedPath = pathname.slice('/dashboard/'.length);
  if (!encodedPath) return undefined;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    return undefined;
  }
  if (
    decodedPath.includes('\0')
    || decodedPath.startsWith('/')
    || decodedPath.includes('\\')
    || decodedPath.split('/').includes('..')
  ) {
    return undefined;
  }
  return normalize(decodedPath);
}

export function resolveDashboardStaticFile({ staticRoot, pathname }) {
  const relativePath = dashboardStaticRelativePath(pathname);
  if (relativePath === undefined) return undefined;
  const root = resolve(staticRoot);
  const filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return undefined;
  return filePath;
}

