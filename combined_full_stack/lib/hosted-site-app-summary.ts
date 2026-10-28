// AI : tiny public-page summary for the isolated UI vibe agent — never prompts, code, or Docs.

import { inputTypeLabel, orderedInputModules } from "@/lib/inference-input"
import { ModuleKind, type Project } from "@/lib/types"

export type HostedSiteUploadSummary = {
  label: string
  accepts: string
  note?: string
  filenameHint?: string
}

export type HostedSiteAppSummary = {
  name: string
  uploads: HostedSiteUploadSummary[]
  outputs: string[]
  steps: string[]
}

export function hostedSiteAppSummary(project: Project): HostedSiteAppSummary {
  const uploads = orderedInputModules(project.modules).map((m) => {
    const row: HostedSiteUploadSummary = {
      label: m.label,
      accepts: inputTypeLabel(m.inputType),
    }
    const note = m.note?.trim()
    if (note) row.note = note
    const hint = m.inputNameContains?.trim()
    if (hint) row.filenameHint = hint
    return row
  })
  const outputs = project.modules.filter((m) => m.kind === ModuleKind.Output).map((m) => m.label)
  const steps = project.modules
    .filter((m) => m.kind !== ModuleKind.Input)
    .slice(0, 8)
    .map((m) => `${m.label} (${m.kind})`)
  return { name: project.name, uploads, outputs, steps }
}

export function hostedSiteAppSummaryText(project: Project): string {
  return JSON.stringify(hostedSiteAppSummary(project), null, 2)
}
