import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Respect a harness/CI-assigned port; fall back to Vite's default.
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
});
