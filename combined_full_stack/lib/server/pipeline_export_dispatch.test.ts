import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed";
import { generatePipelineSourceGo } from "@/lib/server/pipeline_go_export";
import { generatePipelineSourcePy } from "@/lib/server/pipeline_py_export";
import { generatePipelineSourceRust } from "@/lib/server/pipeline_rs_export";
import { generatePipelineSourceTs } from "@/lib/server/pipeline_ts_export";
import { EXPORT_LANGS, STEP_BODY, emitStepBody } from "@/lib/server/pipeline_export_dispatch";
import { ModuleKind, type ModuleId, type PipelineModule, type Project, type ProjectId } from "@/lib/server/types";

function stubModule(kind: ModuleKind): PipelineModule {
  return {
    id: `mod_${kind}` as ModuleId,
    kind,
    label: kind,
    note: "",
    cached: false,
    avgMs: 0,
    avgCostCents: 0,
  };
}

function stubProject(m: PipelineModule): Project {
  return {
    id: "p_dispatch" as ProjectId,
    name: "dispatch",
    kind: "test",
    models: [],
    modules: [m],
    strategies: [],
  };
}

describe("pipeline export dispatch", () => {
  it("has an emitter for every ModuleKind × lang", () => {
    for (const kind of Object.values(ModuleKind)) {
      for (const lang of EXPORT_LANGS) {
        expect(typeof STEP_BODY[kind][lang], `${kind}/${lang}`).toBe("function");
      }
    }
  });

  it("emits LLM schema wiring in all four langs", () => {
    const m = stubModule(ModuleKind.Llm);
    m.prompt = "Summarize.";
    m.model = "deepseek-v4";
    const ctx = { m, project: stubProject(m), inType: "Document", outType: "Summary" };
    expect(emitStepBody("ts", ctx)).toMatch(/llmStructured/);
    expect(emitStepBody("py", ctx)).toMatch(/llm_structured/);
    expect(emitStepBody("go", ctx)).toMatch(/llmStructured/);
    expect(emitStepBody("rs", ctx)).toMatch(/llm_structured/);
  });

  it("wires dispatch into ts/py/go/rs file exporters", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "database_migration.json"));
    expect(generatePipelineSourceTs(project)).toMatch(/async function step_/);
    expect(generatePipelineSourcePy(project)).toMatch(/async def step_/);
    expect(generatePipelineSourceGo(project)).toMatch(/func step_/);
    expect(generatePipelineSourceRust(project)).toMatch(/async fn step_/);
  });
});
