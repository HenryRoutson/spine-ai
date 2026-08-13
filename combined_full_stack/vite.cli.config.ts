import { defineConfig } from "vite"
import path from "node:path"

// AI : vite-node runner for the Ink TUI — tsx cannot load yoga-layout (top-level await).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
