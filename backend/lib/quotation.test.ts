import { describe, it, expect } from "vitest";
import { findQuote } from "./quotation.js";
import type { DocId } from "./types.js";

const SOURCE =
  "Section 7.1 — In the event of a personal data breach, the Company shall notify the relevant supervisory authority without undue delay and in any case within seventy-two (72) hours of becoming aware of the breach.";
const docId = "sha_test" as DocId;

describe("findQuote (langextract-style)", () => {
  it("finds an exact substring and returns correct offsets", () => {
    const q = "within seventy-two (72) hours";
    const m = findQuote(q, SOURCE, docId);
    expect(m.exact).toBe(true);
    expect(SOURCE.slice(m.start, m.end)).toBe(q);
    expect(m.score).toBe(1);
  });

  it("matches despite differing whitespace", () => {
    const m = findQuote("notify   the relevant   supervisory authority", SOURCE, docId);
    expect(m.exact).toBe(true);
    expect(SOURCE.slice(m.start, m.end).replace(/\s+/g, " ")).toContain("notify the relevant supervisory authority");
  });

  it("falls back to a closest fuzzy match when not exact", () => {
    const m = findQuote("breach must be reported within 72 hours", SOURCE, docId);
    expect(m.exact).toBe(false);
    expect(m.score).toBeGreaterThan(0.2); // partial token overlap; still locates a plausible span
    expect(m.start).toBeGreaterThanOrEqual(0);
    expect(m.text.length).toBeGreaterThan(0);
  });
});
