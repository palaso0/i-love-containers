import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { createContainerEnginePlugin } from "./vite-engine-plugin";

export default defineConfig({
  plugins: [react(), createContainerEnginePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
