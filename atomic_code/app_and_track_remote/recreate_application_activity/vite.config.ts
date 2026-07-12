import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/dashboard/",
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:5180",
      "/app": {
        target: "http://localhost:5173",
        changeOrigin: true,
      },
    },
  },
});
