import { describe, it, expect } from "vitest";
import { z } from "zod";
import { llmBatchStructured } from "./llm.js";
import { UsageLedger } from "./usage.js";

const live = process.env.OPENROUTER_API_KEY ? it : it.skip;

describe("llmBatchStructured", () => {
  live("makes one zod-validated call per item and preserves input order", async () => {
    const ledger = new UsageLedger();
    const Item = z.object({ animal: z.string(), legs: z.number().int() });
    const animals = ["spider", "human", "dog"];

    const rows = await llmBatchStructured(
      animals,
      (item) => `How many legs does a ${item} have?`,
      Item,
      { model: "deepseek-v3", ledger },
    );

    expect(rows.length).toBe(3);
    expect(rows.map((r) => r.legs)).toEqual([8, 2, 4]); // order preserved
    expect(ledger.all().length).toBe(3); // one billed call per item
    expect(ledger.totalCents()).toBeGreaterThan(0);
  });
});
