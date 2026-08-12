import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    // AI : default suite is offline/unit only — live OpenRouter parity is npm run test:parity
    // AI : (headless run-engine + export, never Next.js / browser UI).
    include: ["lib/cli/**/*.test.ts", "lib/server/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/pipeline_export_parity.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
