// AI : shared DOM anchor id linking validation errors ↔ diagnosis sessions (keyed by runId).

import type { RunId } from "@/lib/types"

export type DiagnosisRunLinkId = `diagnosis-run-${string}`

export function diagnosisRunLinkId(runId: RunId | string): DiagnosisRunLinkId {
  return `diagnosis-run-${runId}`
}

export function scrollToDiagnosisRunLink(runId: RunId | string): boolean {
  const el = document.getElementById(diagnosisRunLinkId(runId))
  if (!el) return false
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  el.classList.add("ring-2", "ring-primary/50")
  window.setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 2000)
  return true
}
