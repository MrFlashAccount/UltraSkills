import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/dashboard/',
  root: new URL('.', import.meta.url).pathname,
  publicDir: false,
  build: {
    emptyOutDir: true,
    manifest: true,
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: new URL('src/index.html', import.meta.url).pathname,
    },
  },
  plugins: [
    tanstackStart({
      srcDirectory: 'src',
      client: {
        entry: 'client.tsx',
        base: '/dashboard/',
      },
      router: {
        entry: 'router.tsx',
        generatedRouteTree: 'routeTree.gen.ts',
        routesDirectory: 'routes',
      },
      server: {
        build: {
          inlineCss: false,
        },
      },
      prerender: {
        enabled: false,
      },
    }),
    react(),
  ],
});
