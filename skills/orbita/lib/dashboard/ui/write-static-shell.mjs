import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const distRoot = new URL('dist/', import.meta.url);
const clientRoot = new URL('client/', distRoot);
const manifestUrl = new URL('.vite/manifest.json', clientRoot);

function assetHref(path) {
  return `/dashboard/client/${path}`;
}

const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const entry = Object.values(manifest).find((item) => item.isEntry);
if (!entry?.file) {
  throw new Error('dashboard client manifest does not contain an entry asset');
}

await rm(new URL('assets/', distRoot), { force: true, recursive: true });
await rm(new URL('.vite/', distRoot), { force: true, recursive: true });
await rm(new URL('server/', distRoot), { force: true, recursive: true });
await mkdir(distRoot, { recursive: true });

const cssLinks = Array.isArray(entry.css)
  ? entry.css.map((css) => `    <link rel="stylesheet" href="${assetHref(css)}">`).join('\n')
  : '';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Orbita Dashboard</title>
${cssLinks}
  </head>
  <body>
    <div id="orbita-dashboard-root"></div>
    <script type="module" src="${assetHref(entry.file)}"></script>
  </body>
</html>
`;

await writeFile(new URL('index.html', distRoot), html, 'utf8');
console.log(`dashboard static shell wrote ${assetHref(entry.file)}`);
