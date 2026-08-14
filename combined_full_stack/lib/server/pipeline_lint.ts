// AI : pipeline JSON → flat lint list. Graph I/O + structure fields + step custom code + generated export tsc.
// AI : TODO (arch-lint-types) — lint_severity / ExportDiagnostic overlap pipeline_export_lint.ts; one diagnostic type.
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity";
import { withSharedModels } from "./builtin_models";
import { lintPipelineExportTs } from "./pipeline_export_lint";
import { normalizeStructureModels } from "./type_expr";
import {
  InvalidKind,
  computeInvalid,
  computeWarnings,
  invalidIssuesForModule,
  invalidStepMessage,
  warningStepMessage,
} from "./validity";
import type { ModuleId, PipelineModule, Project, ProjectId, Strategy, StructureModel, StructureModelId, TypeAlias } from "./types";

export type lint_severity = "error" | "warning";
export type pipeline_lint_source = "schema" | "structure" | "pipeline" | "step-code" | "export";
export type export_lint_language = "typescript" | "python" | "rust";

export type PipelineLint = {
  severity: lint_severity;
  source: pipeline_lint_source;
  code: string;
  message: string;
  stepId?: ModuleId;
  stepLabel?: string;
  structureId?: StructureModelId;
  structureName?: string;
  language?: export_lint_language;
  file?: string;
  line?: number;
  column?: number;
};

export type LintPipelineOpts = {
  includeExport?: boolean;
};

export type PipelineLintResult = {
  ok: boolean;
  lints: PipelineLint[];
  exports: Partial<Record<export_lint_language, string>>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function schemaLint(message: string): PipelineLint {
  return { severity: "error", source: "schema", code: "schema", message };
}

export function parsePipelineLintInput(
  raw: unknown,
): { ok: true; project: Project } | { ok: false; lints: PipelineLint[] } {
  if (!isRecord(raw)) return { ok: false, lints: [schemaLint("pipeline JSON must be an object")] };
  const body = isRecord(raw.project) ? raw.project : raw;
  if (!Array.isArray(body.models)) return { ok: false, lints: [schemaLint("pipeline JSON needs a models array")] };
  if (!Array.isArray(body.modules)) return { ok: false, lints: [schemaLint("pipeline JSON needs a modules array")] };
  const project: Project = {
    id: (typeof body.id === "string" && body.id ? body.id : "lint") as ProjectId,
    name: typeof body.name === "string" && body.name ? body.name : "untitled",
    kind: typeof body.kind === "string" && body.kind ? body.kind : "custom",
    models: normalizeStructureModels(body.models as StructureModel[]),
    modules: body.modules as PipelineModule[],
    typeAliases: Array.isArray(body.typeAliases) ? (body.typeAliases as TypeAlias[]) : [],
    strategies: Array.isArray(body.strategies) ? (body.strategies as Strategy[]) : [],
    expectedOutputs: isRecord(body.expectedOutputs) ? body.expectedOutputs : undefined,
  };
  return { ok: true, project };
}

function graphLints(project: Project): PipelineLint[] {
  const models = withSharedModels(project.models);
  const typeAliases = project.typeAliases ?? [];
  const invalid = computeInvalid(project.modules, project.models, { typeAliases });
  const out: PipelineLint[] = [];

  for (const issue of computeStructureIssues(project.models, typeAliases)) {
    out.push({
      severity: "error",
      source: "structure",
      code: issue.kind,
      message: structureIssueMessage(issue, models),
      structureId: issue.modelId,
      structureName: models.find((m) => m.id === issue.modelId)?.name,
    });
  }

  for (const m of project.modules) {
    for (const issue of invalidIssuesForModule(invalid, m.id)) {
      if (issue.kind === InvalidKind.StructureField) continue;
      out.push({
        severity: "error",
        source: issue.kind === InvalidKind.CodeCompileError ? "step-code" : "pipeline",
        code: issue.kind,
        message: invalidStepMessage(issue, models, project.modules),
        stepId: m.id,
        stepLabel: m.label,
      });
    }
  }

  for (const [moduleId, warnings] of computeWarnings(project.modules, project.models)) {
    const step = project.modules.find((m) => m.id === moduleId);
    for (const w of warnings) {
      out.push({
        severity: "warning",
        source: "pipeline",
        code: w.kind,
        message: warningStepMessage(w, models, project.modules),
        stepId: moduleId,
        stepLabel: step?.label,
      });
    }
  }

  return out;
}

export function lintPipeline(project: Project, opts: LintPipelineOpts = {}): PipelineLintResult {
  const includeExport = opts.includeExport ?? true;
  const lints = graphLints(project);
  const exports: PipelineLintResult["exports"] = {};
  if (includeExport) {
    const ts = lintPipelineExportTs(project);
    exports.typescript = ts.source;
    for (const d of ts.items) {
      lints.push({
        severity: d.severity,
        source: "export",
        code: d.code,
        message: d.message,
        stepId: d.stepId,
        stepLabel: d.stepLabel,
        language: "typescript",
        file: d.file,
        line: d.line,
        column: d.column,
      });
    }
    // AI : tsc can fail with unparsed stderr (missing binary, spawn error) — items empty must not green-light.
    if (!ts.ok && !lints.some((l) => l.source === "export" && l.severity === "error")) {
      lints.push({
        severity: "error",
        source: "export",
        code: "export-tsc",
        message: ts.diagnostics.join("\n").trim() || "typescript export typecheck failed",
        language: "typescript",
        file: "pipeline.ts",
      });
    }
  }
  return { ok: !lints.some((l) => l.severity === "error"), lints, exports };
}

export function lintPipelineJson(raw: unknown, opts: LintPipelineOpts = {}): PipelineLintResult {
  const parsed = parsePipelineLintInput(raw);
  if (!parsed.ok) return { ok: false, lints: parsed.lints, exports: {} };
  return lintPipeline(parsed.project, opts);
}

export function formatPipelineLintLine(lint: PipelineLint): string {
  const loc = lint.stepLabel
    ? `"${lint.stepLabel}"`
    : lint.structureName ?? lint.file ?? lint.source;
  const pos = lint.line != null ? `:${lint.line}${lint.column != null ? `:${lint.column}` : ""}` : "";
  const lang = lint.language ? `/${lint.language}` : "";
  return `[${lint.severity}] ${lint.source}${lang} ${loc}${pos} ${lint.code}: ${lint.message}`;
}

export function formatPipelineLintCopyText(result: PipelineLintResult): string {
  if (!result.lints.length) return "";
  return result.lints.map(formatPipelineLintLine).join("\n");
}
