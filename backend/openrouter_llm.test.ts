import { describe, it, expect } from "vitest";
import { z } from "zod";
import { getStringResponse, getStructuredResponse } from "./openrouter_llm";

// AI : real openrouter integration tests — module loads root .env on import, so the key is set by here
const hasKey = !!process.env.OPENROUTER_API_KEY;
const live = hasKey ? it : it.skip;

describe("openrouter_llm", () => {
  live(
    "getStringResponse returns a non-empty string",
    async () => {
      const reply = await getStringResponse("Reply with exactly the single word: pong");
      expect(typeof reply).toBe("string");
      expect(reply.toLowerCase()).toContain("pong");
    },
    30_000,
  );

  live(
    "getStructuredResponse returns data matching the zod schema",
    async () => {
      const Capital = z.object({
        country: z.string(),
        capital: z.string(),
        population_millions: z.number(),
      });
      const result = await getStructuredResponse(
        "Give the capital city and approximate population (in millions) of France.",
        Capital,
      );
      // AI : already zod-validated inside the function, this just asserts the shape end-to-end
      expect(Capital.safeParse(result).success).toBe(true);
      expect(result.capital.toLowerCase()).toContain("paris");
    },
    30_000,
  );
});
