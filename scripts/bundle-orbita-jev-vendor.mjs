import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const outfile = 'skills/orbita/lib/call-functions/vendor/ai-evaluation.mjs';
const checkOnly = process.argv.includes('--check');

const normalizeBundledModulePaths = (bundle) =>
  bundle
    .replaceAll(/(?<=\/\/ )(?:(?:\.\.\/)+)?node_modules\//g, 'node_modules/')
    .replaceAll(/(?<=")(?:(?:\.\.\/)+)?node_modules\//g, 'node_modules/')
    .replaceAll(/(?<=\/\/ )\.orbita-jev-vendor-[^/]+\/orbita-jev-vendor-entry\.mjs/g, 'orbita-jev-vendor-entry.mjs')
    .replaceAll(/^[ \t]+$/gm, '');

const tempDir = await mkdtemp(join(process.cwd(), '.orbita-jev-vendor-'));
const entrypoint = join(tempDir, 'orbita-jev-vendor-entry.mjs');

try {
  await writeFile(entrypoint, "export { createGateway, experimental_evaluate as evaluate } from 'ai';\n");

  const result = await Bun.build({
    entrypoints: [entrypoint],
    target: 'node',
    format: 'esm',
    banner: [
      '// Generated vendor bundle for the Vercel AI SDK evaluation client.',
      '// Commit this artifact so ask_jev works from an installed Orbita plugin without package installation.',
    ].join('\n'),
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  const output = result.outputs.find((file) => file.path.endsWith('.mjs') || file.path.endsWith('.js')) ?? result.outputs[0];
  const bundle = normalizeBundledModulePaths(await output.text());
  if (checkOnly) {
    const current = await readFile(outfile, 'utf8').catch(() => '');
    if (current !== bundle) {
      console.error('Generated Jev vendor bundle is stale: run bun run orbita:bundle-jev-vendor');
      process.exitCode = 1;
    }
  } else {
    await mkdir(dirname(outfile), { recursive: true });
    await writeFile(outfile, bundle);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
