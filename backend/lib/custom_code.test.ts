import { describe, it, expect } from "vitest";
import { compileCustomFn, runCustomFn } from "./custom_code.js";
import { openStore } from "./store.js";
import { runPipeline } from "./run_engine.js";
import type { ModuleId, Project, ProjectId } from "./types.js";

describe("compileCustomFn", () => {
  it("compiles an arrow function expression", async () => {
    const fn = compileCustomFn("(input) => input.map((x) => x * 2)");
    expect(await fn([1, 2, 3])).toEqual([2, 4, 6]);
  });

  it("compiles a bare body using `input` with a return", async () => {
    expect(await runCustomFn("return Object.keys(input).sort()", { b: 1, a: 2 })).toEqual(["a", "b"]);
  });

  it("supports async functions", async () => {
    expect(await runCustomFn("async (input) => input + 1", 41)).toBe(42);
  });

  it("rejects an expression that is not a function", () => {
    expect(() => compileCustomFn("(42)")).toThrow(/must evaluate to a function/);
  });
});

describe("custom-code step in a pipeline (offline, no LLM)", () => {
  it("applies the saved (input) => output mapping and records the step", async () => {
    const store = await openStore();
    const doc = store.docs().find((d) => d.label === "inference")!;
    // AI : minimal project — input → custom ts fn → output; runs fully offline
    const project: Project = {
      id: "p_custom_test" as ProjectId,
      name: "Custom Fn Test",
      kind: "test",
      models: [],
      modules: [
        { id: "in" as ModuleId, kind: "input", label: "Doc", inputType: "text", cached: false, avgMs: 1, avgCostCents: 0 },
        {
          id: "fn" as ModuleId,
          kind: "custom-code",
          label: "Word Count",
          code: "(input) => ({ words: input.body.split(/\\s+/).length, doc: input.doc_id })",
          cached: false,
          avgMs: 1,
          avgCostCents: 0,
        },
        { id: "out" as ModuleId, kind: "output", label: "Out", cached: false, avgMs: 1, avgCostCents: 0 },
      ],
      strategies: [],
    };
    store.saveProject(project);

    const run = await runPipeline(store, project.id, doc.id, { persist: false, liveHtml: false });
    expect(run.status).toBe("ok");
    const fnStep = run.steps.find((s) => s.moduleId === "fn")!;
    expect(fnStep.status).toBe("ok");
    const value = JSON.parse(fnStep.outputJson!) as { words: number; doc: string };
    expect(value.words).toBeGreaterThan(100);
    expect(value.doc).toBe(doc.id);
  });
});
