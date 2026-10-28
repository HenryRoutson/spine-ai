import { lintPipeline } from "@/lib/server/pipeline_lint"
import type { ProjectContext } from "@/lib/cli/project_context"
import type { CliCommandResult, CliIssue } from "@/lib/cli/types"

export function lintPipelineCommand(ctx: ProjectContext): CliCommandResult {
  const result = lintPipeline(ctx.project, { includeExport: true })
  const issues: CliIssue[] = result.lints.map((l) => ({
    level: l.severity,
    where: l.stepLabel ?? l.structureName ?? l.file ?? l.source,
    message:
      l.line != null
        ? `${l.code} ${l.message} (${l.file ?? "export"}:${l.line}:${l.column ?? 1})`
        : `${l.code} ${l.message}`,
  }))
  const errors = issues.filter((i) => i.level === "error").length
  return {
    ok: result.ok,
    command: "lint pipeline",
    issues,
    data: {
      projectName: ctx.project.name,
      seedPath: ctx.seedPath,
      lintCount: result.lints.length,
      errorCount: errors,
      summary: errors ? `${errors} lint error(s)` : "pipeline lint clean",
      lints: result.lints,
    },
  }
}
