import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectSeed } from "@/lib/server/seed";
import { computeInvalid } from "@/lib/server/validity";
import { lintPipelineExportTs } from "@/lib/server/pipeline_export_lint";
import { generatePipelineSourceTs } from "@/lib/server/pipeline_ts_export";
import { generateCombineStepBodyTs, prepareExportProject } from "@/lib/server/pipeline_export_shared";
import { SEEDS_DIR } from "@/lib/server/seed";
import { BUILTIN_DOCUMENT_ID } from "@/lib/server/builtin_models";
import { ModuleKind, type ModuleId, type PipelineModule } from "@/lib/server/types";

describe("pipeline TS export lint", () => {
  // AI : TODO (linter-first) — mirror this suite for pyright (pipeline.py) and cargo check (pipeline.rs); make Py/Rust primary.
  const seeds = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"));

  it.each(seeds)("generates lint-clean TS for %s", (file) => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, file));
    const invalid = computeInvalid(project.modules, project.models, {
      typeAliases: project.typeAliases ?? [],
    });
    if (invalid.size > 0) return;

    const result = lintPipelineExportTs(project);
    expect(result.ok, `${file} export lint failed:\n${result.diagnostics.join("\n")}`).toBe(true);
  });

  // AI : regression — old exporter emitted comment placeholders / untyped __fn / empty PipelineState.
  it("does not emit known broken TS export patterns for database_migration", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "database_migration.json"));
    const src = generatePipelineSourceTs(project);
    expect(src).not.toMatch(/\/\* from doc or pipeline \*\//);
    expect(src).not.toMatch(/state\[\s*\/\*/);
    expect(src).not.toMatch(/const __fn = \(/);
    expect(src).not.toMatch(/const state: PipelineState = \{\}/);
    expect(src).toMatch(/const state = \{\} as PipelineState/);
    expect(src).toMatch(/new Function\(/);
  });

  it("combine fallback without upstream label stays syntactically valid", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "database_migration.json"));
    const prepared = prepareExportProject(project);
    const combine = prepared.modules.find((m) => m.kind === ModuleKind.Combine)!;
    const broken = { ...combine, inStructureId: "m_missing" as typeof combine.inStructureId };
    const body = generateCombineStepBodyTs(broken, prepared, "MigrationInput");
    expect(body).not.toMatch(/\/\*/);
    expect(body).toMatch(/\(state as Record<string, unknown>\)\["upstream"\]/);
  });

  it("human-review after list input exports spine-consistent types", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "database_migration.json"));
    const humanReview: PipelineModule = {
      id: "mod_human_review" as ModuleId,
      kind: ModuleKind.HumanReview,
      label: "Human Review",
      note: "",
      inStructureId: BUILTIN_DOCUMENT_ID,
      outStructureId: BUILTIN_DOCUMENT_ID,
      cached: true,
      avgMs: 0,
      avgCostCents: 0,
    };
    const modules = [project.modules[0]!, humanReview, ...project.modules.slice(1)];
    const modified = { ...project, name: "Legacy CRM Migration 1", modules };
    const result = lintPipelineExportTs(modified);
    expect(result.ok, result.diagnostics.join("\n")).toBe(true);
    const src = generatePipelineSourceTs(modified);
    expect(src).toMatch(/async function step_Human_Review\(input: LegacyUser\[\]/);
    expect(src).toMatch(/"Human Review": LegacyUser\[\]/);
  });

  it("example-select export respects exampleContextField", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "billed_work_catalog_select.json"));
    const src = generatePipelineSourceTs(project);
    expect(src).toMatch(/const description = \(typeof \(state\["Normalize Case"\] as Record<string, unknown>\)\["description"\]/);
    expect(src).not.toMatch(/JSON\.stringify\(state\["Normalize Case"\], null, 2\)/);
  });
});
