import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dashboardBuildOutDir = join(tmpdir(), 'orbita-dashboard-start-build');
const dashboardAppRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: dashboardAppRoot,
  build: {
    outDir: dashboardBuildOutDir,
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 4178,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    viteReact(),
  ],
});
