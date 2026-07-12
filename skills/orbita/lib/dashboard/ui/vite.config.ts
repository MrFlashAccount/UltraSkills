/// <reference types="vitest/config" />
import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const uiRoot = path.resolve(import.meta.dirname);
const reactCompiler = () => babel({ presets: [reactCompilerPreset()] });

export default defineConfig({
  plugins: process.env.VITEST
    ? [tailwindcss(), react(), reactCompiler()]
    : [tanstackStart(), nitro({ preset: "bun" }), tailwindcss(), react(), reactCompiler()],
  resolve: {
    alias: {
      "@": path.resolve(uiRoot, "src"),
      "@dashboard-contracts": path.resolve(uiRoot, "../contracts/browser.ts"),
    },
  },
  root: uiRoot,
  server: { watch: { ignored: ["**/e2e/results/**", "**/e2e/proof/**"] } },
  test: {
    environment: "jsdom",
    exclude: ["./src/server/**", "./src/routes/api.dashboard.v1.*.test.ts"],
    include: ["./src/**/*.test.ts", "./src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
