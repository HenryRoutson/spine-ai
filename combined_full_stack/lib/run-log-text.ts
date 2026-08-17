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

  // AI : testing runs carry the persisted verdict — expected vs actual per pinned step.
  if (run.test) {
    lines.push("")
    lines.push(`── Test · ${run.test.testDocName} ──`)
    for (const r of run.test.results) {
      lines.push(`[${r.status.toUpperCase()}] ${r.label}${r.diffPath ? `  (diff at ${r.diffPath})` : ""}`)
      if (r.ignoredPaths?.length) lines.push(`   Probabilistic (LLM-checked): ${r.ignoredPaths.join(", ")}`)
      if (r.tolerantPaths?.length) {
        lines.push(
          `   Tolerant (± compare): ${r.tolerantPaths.map((t) => `${t.path} ±${t.tolerance}`).join(", ")}`,
        )
      }
      if (r.probabilisticResults?.length) {
        lines.push(`   LLM semantic checks (${r.probabilisticResults.filter((x) => x.pass).length}/${r.probabilisticResults.length} pass):`)
        for (const pr of r.probabilisticResults) {
          lines.push(`   [${pr.pass ? "OK" : "FAIL"}] ${pr.path}${pr.reason && !pr.pass ? ` — ${pr.reason}` : ""}`)
          if (pr.expected !== undefined) lines.push(`     expected: ${JSON.stringify(pr.expected)}`)
          if (pr.actual !== undefined) lines.push(`     actual:   ${JSON.stringify(pr.actual)}`)
        }
      }
      if (r.deterministicDiff) lines.push(`   Diff:\n${r.deterministicDiff.split("\n").map((l) => `     ${l}`).join("\n")}`)
      if (r.deterministicDiffExplanations?.length) {
        lines.push(`   Diff explanations:`)
        for (const d of r.deterministicDiffExplanations) {
          lines.push(`     ${d.path}: ${d.reason}`)
        }
      }
      if (r.expected !== undefined) lines.push(`   Expected: ${JSON.stringify(r.expected)}`)
      if (r.actual !== undefined) lines.push(`   Actual:   ${JSON.stringify(r.actual)}`)
    }
  }

  lines.push("")
  lines.push("── Steps ──")

  run.steps.forEach((step, i) => {
    lines.push("")
    lines.push(`${i + 1}. [${step.status.toUpperCase()}] ${step.label}${step.model ? `  (${step.model})` : ""}  ${step.ms}ms  ${formatCostCents(step.costCents)}`)

    if (step.inputPreviewItems?.length) {
      lines.push(`   Input:`)
      for (const item of step.inputPreviewItems) {
        lines.push(`     ── ${item.label} ──`)
        item.text.split("\n").forEach((l) => lines.push(`     ${l}`))
      }
    } else if (step.inputPreview) {
      lines.push(`   Input:`)
      step.inputPreview.split("\n").forEach((l) => lines.push(`     ${l}`))
    }

    if (step.outputPreviewItems?.length) {
      lines.push(`   Responses:`)
      for (const item of step.outputPreviewItems) {
        lines.push(`     ── ${item.label} ──`)
        item.text.split("\n").forEach((l) => lines.push(`     ${l}`))
      }
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
