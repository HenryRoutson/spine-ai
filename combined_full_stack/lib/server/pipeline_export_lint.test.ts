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
import { findQuote as uiFindQuote } from "@/lib/server/quotation";
import {
  configurePipelineRuntime,
  findQuote as exportFindQuote,
  resolveQuotes,
  runN8nCode,
} from "@/lib/export_runtime/ts/pipeline_runtime";
import { resolveN8nForExport } from "@/lib/n8n-step";
import { runN8nPiece } from "@/lib/n8n-run";
import { flattenPipelineModules } from "@/lib/fork-pipeline";

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
    expect(src).toMatch(/const description = \(typeof \(state\["Work Description"\] as Record<string, unknown>\)\["content"\]/);
    expect(src).not.toMatch(/JSON\.stringify\(state\["Work Description"\], null, 2\)/);
  });
  it("billed_work example-select promptColumns omit billed_items", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "billed_work_catalog_select.json"));
    const src = generatePipelineSourceTs(project);
    expect(src).toMatch(/"title","work_description"/);
    expect(src).not.toMatch(/selectRelevant\([^;]*billed_items/);
  });

  it("estimate_intelligence promptColumns omit billed_lines and qty/rate", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "estimate_intelligence.json"));
    const src = generatePipelineSourceTs(project);
    expect(src).toMatch(/"builder_id","title","peril"/);
    expect(src).not.toMatch(/selectRelevant\([^;]*billed_lines/);
    expect(src).toMatch(/"work_item_id","code","trade","description","unit","source_job_id"/);
    expect(src).not.toMatch(/selectRelevant\([^;]*unit_rate/);
  });

  it("emits example-select relevance schema once", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "billed_work_catalog_select.json"));
    const src = generatePipelineSourceTs(project);
    expect(src).toMatch(/from "\.\/pipeline_runtime"/);
    expect(src).toMatch(/selectRelevant/);
    expect(src).not.toMatch(/const relevanceSchema = /);
  });

  it("emits merge runtime once", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "billed_work_catalog_select.json"));
    const src = generatePipelineSourceTs(project);
    expect(src.match(/mergeFold\(/g)?.length).toBe(1);
    expect(src).not.toMatch(/function __itemKeyFn/);
    expect(src).toMatch(/from "\.\/pipeline_runtime"/);
  });

  it("emits builtin VideoClip / ImageStill types for media seeds", () => {
    const clip = generatePipelineSourceTs(loadProjectSeed(resolve(SEEDS_DIR, "generate_clip.json")).project);
    expect(clip).toMatch(/export type VideoClip = /);
    expect(clip).toMatch(/await callWebhook\(input, undefined,/);
    expect(clip).toMatch(/urlEnv: "HIGGSFIELD_GENERATE_URL"/);
    expect(clip).toMatch(/pollStatusUrlPath: "status_url"/);
    expect(clip).toMatch(/ingestUrlPath: "video.url"/);
    const story = generatePipelineSourceTs(loadProjectSeed(resolve(SEEDS_DIR, "storyboard_short.json")).project);
    expect(story).toMatch(/export type ImageStill = /);
    expect(story).toMatch(/export type VideoClip = /);
  });

  it("quote export calls resolveQuotes with field paths", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "company_legal_evaluation.json"));
    const src = generatePipelineSourceTs(project);
    expect(src).toMatch(/resolveQuotes\(input, "", "",/);
    expect(src).not.toMatch(/wire resolveQuotes/);
  });

  it("n8n seeds export executable runN8nCode (UI parity)", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "csv_triage_n8n.json"));
    const src = generatePipelineSourceTs(project);
    expect(src).toMatch(/runN8nCode\(/);
    expect(src).toMatch(/parseCsv/);
    expect(src).not.toMatch(/return input as unknown as ParsedCsv/);
    const result = lintPipelineExportTs(project);
    expect(result.ok, result.diagnostics.join("\n")).toBe(true);
  });

  it("export runN8nCode matches UI runN8nPiece for each n8n step", async () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "csv_triage_n8n.json"));
    const input = {
      csv: "vendor,amount,status\nAcme,40,open\nBeta,12,closed\nAcme,9,open",
    };
    let spine: unknown = input;
    for (const m of flattenPipelineModules(project.modules)) {
      if (m.kind !== ModuleKind.N8n) continue;
      const r = resolveN8nForExport(m);
      const ui = await runN8nPiece({
        n8nNodeType: r.nodeType,
        n8nCode: m.n8nCode,
        n8nParameters: m.n8nParameters,
        input: spine,
        timeoutMs: r.timeoutMs,
      });
      const exp = await runN8nCode(r.code, r.params, spine, r.timeoutMs);
      expect(exp, m.label).toEqual(ui);
      spine = ui;
    }
  });
  it("export findQuote matches the UI linker", () => {
    const source = "The tenant shall pay rent on the first day of each month.";
    const quote = "pay rent on the first day";
    const ui = uiFindQuote(quote, source, "doc-1");
    const exp = exportFindQuote(quote, source, "doc-1");
    expect(exp).toEqual({
      text: ui.text,
      docId: ui.docId,
      start: ui.start,
      end: ui.end,
      exact: ui.exact,
      score: ui.score,
    });
  });

  it("resolveQuotes links text_quote objects the same way as the UI", () => {
    const source = "Alpha beta gamma";
    configurePipelineRuntime({ sourceText: source, sourceDocId: "d1" });
    const out = resolveQuotes({ rule: { text: "beta", quote: "beta" } }, "", "", ["rule"], false) as {
      rule: { text: string; quote: { doc_id: string; start: number; end: number } };
    };
    expect(out.rule.quote.doc_id).toBe("d1");
    expect(source.slice(out.rule.quote.start, out.rule.quote.end).toLowerCase()).toContain("beta");
  });
});
