/// <reference types="vitest/config" />
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const uiRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: uiRoot,
  plugins: process.env.VITEST ? [tailwindcss(), react()] : [tanstackStart(), nitro({ preset: 'bun' }), tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(uiRoot, 'src'),
      '@dashboard-contracts': path.resolve(uiRoot, '../contracts/browser.ts'),
    },
  },
  server: { watch: { ignored: ['**/e2e/results/**', '**/e2e/proof/**'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['./src/**/*.test.ts', './src/**/*.test.tsx'],
    exclude: ['./src/server/**', './src/routes/api.dashboard.v1.*.test.ts'],
  },
});
