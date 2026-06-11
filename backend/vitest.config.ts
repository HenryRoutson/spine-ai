import { defineConfig } from "vitest/config";

// AI : tests share one local JSON store on disk — run them serially to avoid write races.
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 180_000, // live pipeline tests make several real LLM calls over full documents
  },
});
