import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/bootstrap-env.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "../combined_full_stack"),
    },
    modules: [
      resolve(__dirname, "../combined_full_stack/node_modules"),
      resolve(__dirname, "node_modules"),
      "node_modules",
    ],
  },
})
