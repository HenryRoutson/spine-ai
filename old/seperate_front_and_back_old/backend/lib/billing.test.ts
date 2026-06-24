import { describe, it, expect } from "vitest";
import { billingFromRuns, spendSplit, totalSaved, seededBillingSeries, billingSeries } from "./billing.js";
import type { PipelineRun, RunId } from "./types.js";

const run: PipelineRun = {
  id: "run_x" as RunId,
  startedAt: Date.parse("2026-06-11T10:00:00Z"),
  status: "ok",
  totalMs: 5000,
  billedCents: 0.5,
  savedCents: 0.3,
  model: "qwen-2.5-72b",
  steps: [
    { moduleId: "a", kind: "doc-to-text", label: "Doc", status: "ok", ms: 400, costCents: 0.1, inputPreview: "", outputPreview: "" } as PipelineRun["steps"][number],
    { moduleId: "b", kind: "llm", label: "LLM", model: "qwen-2.5-72b", status: "ok", ms: 2000, costCents: 0.4, inputPreview: "", outputPreview: "" } as PipelineRun["steps"][number],
    { moduleId: "c", kind: "llm", label: "LLM2", model: "claude-opus-4.6", status: "ok", ms: 2600, costCents: 0.9, inputPreview: "", outputPreview: "" } as PipelineRun["steps"][number],
  ],
};

describe("billing aggregation", () => {
  it("buckets spend by day, splitting model lines from the doc-parse service", () => {
    const series = billingFromRuns([run]);
    expect(series.length).toBe(1);
    const point = series[0];
    expect(point["doc-parse svc"]).toBeCloseTo(0.1);
    expect(point["Qwen 2.5 72B"]).toBeCloseTo(0.4);
    expect(point["Claude Opus 4.6"]).toBeCloseTo(0.9);
  });

  it("splits cheap vs frontier spend (excludes the parse service)", () => {
    const split = spendSplit([run]);
    expect(split.cheapCents).toBeCloseTo(0.4);
    expect(split.frontierCents).toBeCloseTo(0.9);
  });

  it("totals cache savings", () => {
    expect(totalSaved([run])).toBeCloseTo(0.3);
  });

  it("falls back to the seeded series with no runs", () => {
    expect(seededBillingSeries().length).toBe(7);
    expect(billingSeries([]).length).toBe(7);
    expect(billingSeries([run]).length).toBe(1);
  });
});
