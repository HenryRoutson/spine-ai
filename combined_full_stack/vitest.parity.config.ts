// AI : live OpenRouter parity only — headless run-engine + TS export, never Next.js / browser.
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/server/pipeline_export_parity.test.ts"],
    testTimeout: 900_000,
    // AI : one seed at a time — parallel workers trip OpenRouter 429s and stall forever.
    fileParallelism: false,
    maxWorkers: 1,
    // AI : show per-seed lines only; server logs stay muted via PARITY_QUIET.
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
