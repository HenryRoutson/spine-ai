// AI : project + pipeline validation — mirrors Structure/Pipeline tab gates without React.
// AI : TODO (arch-validate-wrap) — remaps computeInvalid / computeStructureIssues; wrap lintPipeline instead.

import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import { computeInvalid, invalidIssuesForModule } from "@/lib/validity"
import { invalidStepMessage } from "@/lib/server/validity-messages"
import { withSharedModels } from "@/lib/server/builtin_models"
import type { ProjectContext } from "@/lib/cli/project_context"
import type { CliCommandResult, CliIssue } from "@/lib/cli/types"

function structureIssues(ctx: ProjectContext): CliIssue[] {
  const { models, typeAliases = [] } = ctx.project
  return computeStructureIssues(models, typeAliases).map((issue) => ({
    level: "error" as const,
    where: issue.modelId ?? "structure",
    message: structureIssueMessage(issue, models),
  }))
}

function pipelineIssues(ctx: ProjectContext): CliIssue[] {
  const { modules, models, typeAliases = [] } = ctx.project
  const invalid = computeInvalid(modules, models, { typeAliases })
  const modelsForMessages = withSharedModels(models)
  const issues: CliIssue[] = []
  for (const m of modules) {
    for (const issue of invalidIssuesForModule(invalid, m.id)) {
      const message =
        issue.kind === "structure-field"
          ? (issue.structureMessage ?? "structure field error")
          : invalidStepMessage(issue, modelsForMessages, modules)
      issues.push({ level: "error", where: m.label, message })
    }
  }
  return issues
}

export function validateProjectCommand(ctx: ProjectContext): CliCommandResult {
  const issues = [...structureIssues(ctx), ...pipelineIssues(ctx)]
  return {
    ok: !issues.length,
    command: "validate project",
    issues,
    data: {
      projectName: ctx.project.name,
      seedPath: ctx.seedPath,
      summary: issues.length ? `${issues.length} validation issue(s)` : "project valid",
    },
  }
}
