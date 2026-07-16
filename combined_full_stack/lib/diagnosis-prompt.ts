// AI : build diagnosis context from a failed run — pipeline at run time + error-only log.

import { runErrorLogJsonObject, runErrorLogText } from "@/lib/run-error-log"
import type { PipelineModule, PipelineRun, Project } from "@/lib/types"

export function buildDiagnosisSystemPrompt(): string {
  return `You diagnose failed linear LLM pipeline runs.

You receive:
- The pipeline configuration as it existed when the run executed
- Error-only log excerpts (failed steps, validation messages, server warnings/errors)
- Optional test assertion failures

Your job:
1. Explain the most likely root cause in plain language
2. Point to the specific pipeline step(s) responsible
3. Suggest concrete fixes (prompt edits, structure changes, input checks, code fixes)
4. Note if the failure looks transient (provider/rate limit) vs structural

Do NOT propose unrelated refactors. Stay scoped to the provided error context.
Write concise markdown with sections: ## Root cause, ## Evidence, ## Recommended fix.`
}

export function buildDiagnosisUserPrompt(
  project: Project,
  run: PipelineRun,
  userMessage: string,
): string {
  const errorJson = runErrorLogJsonObject(run, project.modules, { includePipeline: true })
  const errorText = runErrorLogText(run, { includePipeline: true })
  const modelsJson = JSON.stringify(
    project.models.map((m) => ({
      name: m.name,
      description: m.description,
      fields: m.fields.map((f) => ({
        name: f.name,
        type: f.type,
        optional: f.optional,
        ref: f.ref ? project.models.find((x) => x.id === f.ref)?.name : undefined,
      })),
    })),
    null,
    2,
  )

  return `Project: ${project.name} (${project.id})

Structure models:
${modelsJson}

Pipeline at run time (${errorJson.pipelineAtRun.length} steps):
${JSON.stringify(errorJson.pipelineAtRun, null, 2)}

Error-only log (text):
${errorText}

Error-only log (JSON):
${JSON.stringify(errorJson, null, 2)}

User request:
${userMessage.trim()}`
}

export function defaultDiagnosisMessage(): string {
  return "Diagnose this failed inference run. Explain the root cause and recommend the smallest fix to get the pipeline passing."
}
