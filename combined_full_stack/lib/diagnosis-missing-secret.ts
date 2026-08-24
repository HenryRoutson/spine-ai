// AI : deterministic diagnosis when a run failed on a missing Library → Secrets key.
import { runErrorLogText } from "@/lib/run-error-log"
import type { ModuleId, PipelineRun, Project } from "@/lib/types"
import {
  collectSecretRequirements,
  formatMissingSecretsError,
  groupSecretRequirements,
  missingWebhookSecretMessage,
} from "@/lib/webhook-step"

const MISSING_SECRET_RE = /([A-Z][A-Z0-9_]{0,127}) is not set\. Add it in Library → Secrets/g

export function missingSecretNamesFromText(text: string): string[] {
  const names: string[] = []
  for (const match of text.matchAll(MISSING_SECRET_RE)) {
    const name = match[1]
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

export function diagnosisForMissingSecrets(project: Project, run: PipelineRun): string | null {
  const errorText = runErrorLogText(run, { includePipeline: true })
  const fromLog = missingSecretNamesFromText(errorText)
  const reqs = collectSecretRequirements(project.modules).filter((r) => !r.optional)
  const named = fromLog.length
    ? reqs.filter((r) => fromLog.includes(r.name))
    : reqs.filter((r) => errorText.includes(missingWebhookSecretMessage(r.name)))
  if (!named.length && !fromLog.length) return null
  const missing = named.length ? named : fromLog.map((name) => ({
    name,
    stepId: run.steps.find((s) => s.status === "error")?.moduleId ?? ("mod_unknown" as ModuleId),
    stepLabel: run.steps.find((s) => s.status === "error")?.label ?? "webhook",
    role: "auth" as const,
    optional: false,
  }))
  const grouped = groupSecretRequirements(missing)
  const first = grouped[0]
  if (!first) return null
  const stepList = first.steps.join(", ")
  const allNames = grouped.map((g) => g.name).join(", ")
  return [
    "## Root cause",
    `The pipeline failed because required secret${grouped.length > 1 ? "s" : ""} ${allNames} ${grouped.length > 1 ? "were" : "was"} not configured.`,
    "",
    "## Evidence",
    `1. ${formatMissingSecretsError(missing)}`,
    `2. Required by: ${stepList}`,
    "3. This is a configuration issue — pipeline logic and prompts are unrelated.",
    "",
    "## Recommended fix",
    "1. Add the required API key:",
    "   - Go to Library → Secrets",
    ...grouped.map((g) => `   - Add \`${g.name}\` (used by ${g.steps.join(", ")})`),
    "   - Alternatively, set it as an environment variable if running locally",
    "",
    "This is a structural issue (not transient). Inference is blocked until these secrets are set. No pipeline edits are needed.",
  ].join("\n")
}
