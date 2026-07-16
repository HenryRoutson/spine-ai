import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { generatePipelineSourceTs } from "./pipeline_ts_export";
import type { Project } from "./types";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TSC_BIN = join(PROJECT_ROOT, "node_modules", "typescript", "bin", "tsc");

export type PipelineExportLintResult = {
  ok: boolean;
  diagnostics: string[];
};

// AI : typecheck generated pipeline export — catches codegen regressions before copy/export.
// AI : TODO (linter-first) — add lintPipelineExportPy (pyright) + lintPipelineExportRust (cargo check); TS lint is fallback.
export function lintPipelineExportTs(project: Project): PipelineExportLintResult {
  const dir = mkdtempSync(join(tmpdir(), "forge-pipeline-export-"));
  try {
    const source = generatePipelineSourceTs(project);
    writeFileSync(join(dir, "pipeline.ts"), source, "utf8");
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
          },
          include: ["pipeline.ts"],
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
    return { ok: (tsc.status ?? 1) === 0, diagnostics };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
