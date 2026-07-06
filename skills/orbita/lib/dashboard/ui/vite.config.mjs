import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/dashboard/',
  plugins: [
    tanstackRouter({
      target: 'react',
      enableRouteGeneration: false,
      disableLogging: true,
    }),
    react(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.mjs', '.js', '.json'],
  },
});
