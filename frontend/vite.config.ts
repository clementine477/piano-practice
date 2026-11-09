import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// Desktop assets ship inside the app; a service worker/update cache is unnecessary.
export default defineConfig({
  plugins: [{ name: "local-alphatab", enforce: "pre", resolveId(id) { if (id === "@coderline/alphatab") return { id: "/alphatab/alphaTab.mjs", external: true }; } }, react(), tailwindcss()],
  resolve: { alias: { "@bach-to-basics/shared": resolve(__dirname, "../shared/types/index.ts") } },
  // alphaTab 1.8.3's published Vite plugin references missing files.
  // Keep its official ESM release intact so relative worker/worklet URLs resolve.
  build: {
    rolldownOptions: {
      preserveEntrySignatures: "exports-only",
      external: ["@coderline/alphatab"],
      output: {
        paths: { "@coderline/alphatab": "/alphatab/alphaTab.mjs" },
      },
    },
  },
  server: { port: 5173 },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@coderline/alphatab"], include: ["pixi.js"] },
});
