// AI : *_inference.json validation — Inference tab presets without the React shell.

import { resolve } from "node:path"
import {
  parseInferenceSetupFile,
  validateInferenceSetupFile,
  type SetupFileIssue,
} from "@/lib/inference-setup-files"
import { loadProjectContext, readTextFile, type ProjectContext } from "@/lib/cli/project_context"
import type { CliCommandResult, CliIssue } from "@/lib/cli/types"

function toCliIssues(issues: SetupFileIssue[]): CliIssue[] {
  return issues.map((i) => ({ level: i.level, where: i.where, message: i.message }))
}

export function validateSetupCommand(ctx: ProjectContext, setupPath: string): CliCommandResult {
  const abs = resolve(setupPath)
  const parsed = parseInferenceSetupFile(readTextFile(abs))
  if (!parsed.ok) {
    return {
      ok: false,
      command: "validate setup",
      issues: [{ level: "error", where: abs, message: parsed.error }],
      data: { projectName: ctx.project.name, setupFile: abs },
    }
  }
  const issues = toCliIssues(validateInferenceSetupFile(parsed.setup, ctx.project, ctx.docRefs))
  return {
    ok: !issues.some((i) => i.level === "error"),
    command: "validate setup",
    issues,
    data: { projectName: ctx.project.name, setupFile: abs },
  }
}

export function loadContextAndValidateSetup(seedPath: string, setupPath: string): CliCommandResult {
  return validateSetupCommand(loadProjectContext(seedPath), setupPath)
}
