import { describe, it, expect } from "vitest";
import { filterRuns, progressHtml, runToHtml, runToMarkdown, type LiveStep } from "./logging.js";
import type { PipelineRun, RunId } from "./types.js";

const run: PipelineRun = {
  id: "run_1" as RunId,
  startedAt: Date.now(),
  status: "ok",
  totalMs: 1200,
  billedCents: 0.6,
  savedCents: 0,
  model: "qwen-2.5-72b",
  steps: [
    { moduleId: "a", kind: "llm", label: "Extract", model: "qwen-2.5-72b", status: "ok", ms: 1200, costCents: 0.6, inputPreview: "doc", outputPreview: "5 rules", outputJson: '{"rules":5}' } as PipelineRun["steps"][number],
  ],
};

describe("logging", () => {
  it("filters runs by model, step kind, and id", () => {
    expect(filterRuns([run], { model: "qwen-2.5-72b" }).length).toBe(1);
    expect(filterRuns([run], { kind: "llm" }).length).toBe(1);
    expect(filterRuns([run], { kind: "combine" }).length).toBe(0);
    expect(filterRuns([run], { runId: "nope" as RunId }).length).toBe(0);
  });

  it("renders markdown with a fenced json block", () => {
    const md = runToMarkdown(run);
    expect(md).toContain("# Run run_1");
    expect(md).toContain("```json");
  });

  it("renders a high-level html view with a progress bar", () => {
    const html = runToHtml(run);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("class=\"fill\"");
    expect(html).toContain("Extract");
  });

  it("progressHtml live view auto-refreshes, pulses the running step, lists pending", () => {
    const steps: LiveStep[] = [
      { label: "A", kind: "llm", status: "ok", ms: 120, costCents: 0.2 },
      { label: "B", kind: "llm", status: "running", ms: 0, costCents: 0 },
      { label: "C", kind: "output", status: "pending", ms: 0, costCents: 0 },
    ];
    const live = progressHtml("t", "s", steps, true);
    expect(live).toContain('http-equiv="refresh"');
    expect(live).toContain("fill pulse");
    expect(live).toContain("running…");

    const done = progressHtml("t", "s", steps.slice(0, 1), false);
    expect(done).not.toContain('http-equiv="refresh"');
  });
});
