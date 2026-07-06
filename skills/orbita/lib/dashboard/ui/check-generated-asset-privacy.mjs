import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distRoot = new URL('dist/', import.meta.url);
const forbiddenPatterns = [
  /\/Users\//,
  /\.orbita\/workflow-runs/,
  /raw artifact path/i,
  /instruction storage/i,
  /lease-token/i,
  /workflow run private state/i,
];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

if (!existsSync(distRoot)) {
  console.error('dashboard dist output is missing; run bun run dashboard:build first');
  process.exit(1);
}

const files = walk(distRoot.pathname);
const mapFiles = files.filter((file) => file.endsWith('.map'));
if (mapFiles.length > 0) {
  console.error(`dashboard build emitted source maps: ${mapFiles.join(', ')}`);
  process.exit(1);
}

for (const file of files.filter((path) => /\.(?:html|js|css|json)$/i.test(path))) {
  const text = readFileSync(file, 'utf8');
  const leakedPattern = forbiddenPatterns.find((pattern) => pattern.test(text));
  if (leakedPattern) {
    console.error(`dashboard asset privacy check failed for ${file}: ${leakedPattern}`);
    process.exit(1);
  }
}

console.log(`dashboard asset privacy check passed for ${files.length} files`);
