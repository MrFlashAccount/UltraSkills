import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outfile = 'shared/scripts/schema-validation/vendor/ajv.mjs';

const normalizeBundledModulePaths = (bundle) =>
  bundle
    .replaceAll(/(?<=\/\/ )(?:(?:\.\.\/)+)?node_modules\//g, 'node_modules/')
    .replaceAll(/(?<=")(?:(?:\.\.\/)+)?node_modules\//g, 'node_modules/')
    .replaceAll(/(?<=\/\/ )\.schema-validation-vendor-ajv-[^/]+\/schema-validation-vendor-ajv-entry\.mjs/g, 'schema-validation-vendor-ajv-entry.mjs');

const tempDir = await mkdtemp(join(process.cwd(), '.schema-validation-vendor-ajv-'));
const entrypoint = join(tempDir, 'schema-validation-vendor-ajv-entry.mjs');

try {
  await writeFile(entrypoint, "export { default } from 'ajv/dist/2020.js';\n");

  const result = await Bun.build({
    entrypoints: [entrypoint],
    target: 'node',
    format: 'esm',
    banner: [
      '// Generated vendor bundle for Ajv 2020.',
      '// Commit this artifact so schema-validation works from a fresh clone without dependency install/build.',
    ].join('\n'),
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  const output = result.outputs.find((file) => file.path.endsWith('.mjs') || file.path.endsWith('.js')) ?? result.outputs[0];
  const bundle = await output.text();
  await writeFile(outfile, normalizeBundledModulePaths(bundle));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
