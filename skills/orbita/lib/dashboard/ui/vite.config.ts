import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const uiRoot = path.resolve(import.meta.dirname);
const reactCompiler = () => babel({ presets: [reactCompilerPreset()] });

if (!globalThis.Bun?.TOML?.parse) {
  throw new Error("Dashboard runtime requires Bun");
}

export default defineConfig({
  plugins: [tanstackStart(), nitro({ preset: "bun" }), tailwindcss(), react(), reactCompiler()],
  resolve: {
    alias: {
      "@": path.resolve(uiRoot, "src"),
      "@dashboard-contracts": path.resolve(uiRoot, "../contracts/browser.ts"),
    },
  },
  root: uiRoot,
  server: { watch: { ignored: ["**/e2e/results/**", "**/e2e/proof/**"] } },
});
