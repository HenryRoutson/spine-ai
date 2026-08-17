import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "fs";
// AI : TODO (arch-lint-types) — lint_severity / ExportDiagnostic overlap pipeline_lint.ts; one diagnostic type.
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { generatePipelineSourceTs } from "./pipeline_ts_export";
import { exportRuntimeTsPath } from "./pipeline_export_runtime_files";
import { stepFnNameFromLabel } from "./pipeline_export_shared";
import type { ModuleId, PipelineModule, Project } from "./types";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TSC_BIN = join(PROJECT_ROOT, "node_modules", "typescript", "bin", "tsc");

export type lint_severity = "error" | "warning";

export type ExportDiagnostic = {
  severity: lint_severity;
  code: string;
  message: string;
  file: string;
  line: number;
  column: number;
  stepId?: ModuleId;
  stepLabel?: string;
};

export type PipelineExportLintResult = {
  ok: boolean;
  diagnostics: string[];
  items: ExportDiagnostic[];
  source: string;
};

type step_fn_span = {
  startLine: number;
  endLine: number;
  step: PipelineModule;
};

// AI : map generated `async function step_*` ranges back onto pipeline modules.
export function stepSpansFromExportTs(source: string, project: Project): step_fn_span[] {
  const names = project.modules.map((m, i) => ({ m, fn: stepFnNameFromLabel(m, i) }));
  const lines = source.split("\n");
  const spans: step_fn_span[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(/^async function (step_\w+)\(/);
    if (!match) continue;
    const hit = names.find((n) => n.fn === match[1]);
    if (!hit) continue;
    let startLine = i + 1;
    for (let j = i - 1; j >= 0; j--) {
      const t = lines[j]!.trim();
      if (t === "/**") {
        startLine = j + 1;
        break;
      }
      if (t && !t.startsWith("*") && t !== "*/") break;
    }
    spans.push({ startLine, endLine: lines.length, step: hit.m });
  }
  const orch = lines.findIndex((l) => /=== orchestrator ===/.test(l));
  for (let i = 0; i < spans.length; i++) {
    const next = spans[i + 1];
    spans[i]!.endLine = next ? next.startLine - 1 : orch >= 0 ? orch : lines.length;
  }
  return spans;
}

export function stepAtExportLine(
  spans: step_fn_span[],
  line: number,
): { stepId: ModuleId; stepLabel: string } | undefined {
  const hit = spans.find((s) => line >= s.startLine && line <= s.endLine);
  if (!hit) return undefined;
  return { stepId: hit.step.id, stepLabel: hit.step.label };
}

const TSC_LINE =
  /^(?<file>.+)\((?<line>\d+),(?<column>\d+)\):\s+(?<severity>error|warning)\s+(?<code>TS\d+):\s+(?<message>.*)$/;

export function parseTscDiagnostics(output: string, source: string, project: Project): ExportDiagnostic[] {
  const spans = stepSpansFromExportTs(source, project);
  const items: ExportDiagnostic[] = [];
  let pending: ExportDiagnostic | undefined;
  for (const raw of output.split("\n")) {
    const line = raw.trimEnd();
    const m = line.match(TSC_LINE);
    if (m?.groups) {
      if (pending) items.push(pending);
      const loc = stepAtExportLine(spans, Number(m.groups.line));
      pending = {
        severity: m.groups.severity as lint_severity,
        code: m.groups.code!,
        message: m.groups.message!,
        file: m.groups.file!.replace(/\\/g, "/").split("/").pop() ?? m.groups.file!,
        line: Number(m.groups.line),
        column: Number(m.groups.column),
        stepId: loc?.stepId,
        stepLabel: loc?.stepLabel,
      };
      continue;
    }
    if (pending && line.trim()) pending.message = `${pending.message}\n${line.trim()}`;
  }
  if (pending) items.push(pending);
  return items;
}

// AI : typecheck generated pipeline export — catches codegen regressions before copy/export.
// AI : TODO (linter-first) — add lintPipelineExportPy (pyright) + lintPipelineExportRust (cargo check); TS lint is fallback.
export function lintPipelineExportTs(project: Project): PipelineExportLintResult {
  const dir = mkdtempSync(join(tmpdir(), "forge-pipeline-export-"));
  try {
    const source = generatePipelineSourceTs(project);
    writeFileSync(join(dir, "pipeline.ts"), source, "utf8");
    copyFileSync(exportRuntimeTsPath(), join(dir, "pipeline_runtime.ts"));
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            moduleResolution: "bundler",
            target: "ES2022",
            module: "ESNext",
            pretty: false,
          },
          include: ["pipeline.ts", "pipeline_runtime.ts"],
        },
        null,
        2,
      ),
      "utf8",
    );

    const tsc = spawnSync(process.execPath, [TSC_BIN, "-p", join(dir, "tsconfig.json")], {
      encoding: "utf8",
    });
    const output = `${tsc.stdout ?? ""}${tsc.stderr ?? ""}`.trim();
    const diagnostics = output ? output.split("\n").filter(Boolean) : [];
    const items = parseTscDiagnostics(output, source, project);
    return { ok: (tsc.status ?? 1) === 0, diagnostics, items, source };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
