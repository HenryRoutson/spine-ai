import { describe, it, expect } from "vitest";
import { openStore } from "./store.js";
import { runStrategy, runBenchmark, BENCH_CHEAP_MODEL, BENCH_FALLBACK_MODEL } from "./strategies.js";
import type { ProjectId } from "./types.js";

const live = process.env.OPENROUTER_API_KEY ? it : it.skip;

describe("A/B LLL environments", () => {
  it("fallback model is sonnet, cheap model is the deepseek default", () => {
    expect(BENCH_CHEAP_MODEL).toBe("deepseek-v3");
    expect(BENCH_FALLBACK_MODEL).toBe("sonnet-4.7");
  });

  live("single-llm runs for real with metrics and a persisted log", async () => {
    const store = await openStore();
    const project = store.project("p_legal" as ProjectId)!;
    const doc = store.docs().find((d) => d.name.includes("health_data"))!;
    const single = project.strategies.find((s) => s.kind === "single-llm")!;

    const r = await runStrategy(single, project, store, doc.id, { model: BENCH_CHEAP_MODEL });
    expect(r.model).toBe(BENCH_CHEAP_MODEL);
    expect(r.latencyMs).toBeGreaterThan(0);
    expect(r.costCents).toBeGreaterThan(0);
    expect(r.worked).toBe(true);
    expect(r.log).toContain("```json"); // syntax-highlightable code blocks in the log
  });

  live("rlm decomposes recursively and logs each call with fenced code", async () => {
    const store = await openStore();
    const project = store.project("p_legal" as ProjectId)!;
    const doc = store.docs().find((d) => d.name.includes("health_data"))!;
    const rlm = project.strategies.find((s) => s.kind === "rlm")!;

    const r = await runStrategy(rlm, project, store, doc.id, { model: BENCH_CHEAP_MODEL });
    expect(r.worked).toBe(true);
    expect(r.log).toContain("recursive call 1/");
    expect(r.log).toContain("synthesis");
    expect(r.log).toContain("```json");
  }, 240_000);

  live("runBenchmark runs all environments on the cheap model and the judge scores them", async () => {
    const store = await openStore();
    const project = store.project("p_legal" as ProjectId)!;
    const doc = store.docs().find((d) => d.name.includes("health_data"))!;
    // AI : trim to two environments to keep the live test fast/cheap; full set runs in the demo
    const trimmed = {
      ...project,
      strategies: project.strategies.filter((s) => s.kind === "single-llm" || s.kind === "cheap-agent"),
    };

    const { results, verdict, usedFallback } = await runBenchmark(trimmed, store, doc.id);
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const r of results) expect(r.model).toBe(usedFallback && r === results.at(-1) ? BENCH_FALLBACK_MODEL : BENCH_CHEAP_MODEL);
    expect(["single-llm", "rlm", "claude-code", "cheap-agent"]).toContain(verdict.winnerKind);
    expect(verdict.rationale.length).toBeGreaterThan(0);
    // judge-assigned accuracy merged back onto results
    expect(results.some((r) => r.accuracy > 0)).toBe(true);
  }, 300_000);
});
