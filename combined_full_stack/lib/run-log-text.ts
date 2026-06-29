// AI : serialises a PipelineRun to a plain-text string suitable for copying to clipboard.
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import type { PipelineRun } from "@/lib/types"

export function runLogText(run: PipelineRun): string {
  const lines: string[] = []

  lines.push(`Run: ${run.id}`)
  lines.push(`Status: ${run.status}`)
  lines.push(`Model: ${run.model}`)
  lines.push(`Started: ${new Date(run.startedAt).toISOString()}`)
  lines.push(`Duration: ${formatSecondsShort(run.totalMs)}`)
  lines.push(`Cost: ${formatCostCents(run.billedCents)}`)
  if (run.savedCents > 0) lines.push(`Saved (cache): ${formatCostCents(run.savedCents)}`)
  if (run.notes) lines.push(`Notes: ${run.notes}`)
  lines.push("")
  lines.push("── Steps ──")

  run.steps.forEach((step, i) => {
    lines.push("")
    lines.push(`${i + 1}. [${step.status.toUpperCase()}] ${step.label}${step.model ? `  (${step.model})` : ""}  ${step.ms}ms  ${formatCostCents(step.costCents)}`)

    if (step.inputPreview) {
      lines.push(`   Input:`)
      step.inputPreview.split("\n").forEach((l) => lines.push(`     ${l}`))
    }

    const output = step.outputJson ?? step.outputPreview
    if (output && step.status !== "error") {
      lines.push(`   Output:`)
      output.split("\n").forEach((l) => lines.push(`     ${l}`))
    }

    if (step.status === "error" && step.outputPreview) {
      lines.push(`   Error:`)
      step.outputPreview.split("\n").forEach((l) => lines.push(`     ${l}`))
    }

    if (step.failures && step.failures.length > 0) {
      lines.push(`   Failures:`)
      step.failures.forEach((f) => lines.push(`     [${f.kind}] ${f.detail}`))
    }
  })

  return lines.join("\n")
}
