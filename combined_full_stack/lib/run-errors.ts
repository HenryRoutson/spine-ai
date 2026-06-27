import type { PipelineRun } from "@/lib/types"
import {
  describeInputDescriptionFailure,
  inputRejectedReasonFromMessage,
  resolveInputDescriptionCheck,
} from "@/lib/input-description"

export type RunErrorDisplay = {
  title: string
  message: string
  detail?: string
  stepLabel?: string
}

type ZodIssue = {
  path?: (string | number)[]
  message?: string
  expected?: string
  code?: string
}

// AI : step errors live on RunStep.outputPreview — surface them instead of a generic "run error".
export function pipelineRunError(run: PipelineRun): string | null {
  const step = run.steps.find((s) => s.status === "error")
  if (!step) return run.status === "error" ? "Pipeline failed" : null
  return step.outputPreview ? `${step.label}: ${step.outputPreview}` : `${step.label} failed`
}

function parseZodIssues(raw: string): ZodIssue[] | undefined {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("[")) return undefined
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return Array.isArray(parsed) ? (parsed as ZodIssue[]) : undefined
  } catch {
    return undefined
  }
}

function fieldPathLabel(path: (string | number)[]): string {
  const parts = path.map((p) => (typeof p === "number" ? `#${p + 1}` : p.replace(/_/g, " ")))
  return parts.join(" → ")
}

function friendlyValidationIssue(issue: ZodIssue): string {
  const path = issue.path ?? []
  const leaf = path[path.length - 1]
  const leafName = typeof leaf === "string" ? leaf.replace(/_/g, " ") : undefined

  if (leafName === "content") {
    const where = path.length ? fieldPathLabel(path) : "A document"
    return `${where} is missing its text.`
  }
  if (leafName === "filename") {
    const where = path.length ? fieldPathLabel(path) : "A document"
    return `${where} is missing its filename.`
  }

  const where = path.length ? fieldPathLabel(path) : "output"
  const msg = issue.message?.trim()
  if (msg && !msg.startsWith("Invalid input")) return `${where}: ${msg}`
  if (issue.expected) return `${where} should be ${issue.expected}.`
  return `${where} has an invalid value.`
}

function friendlyValidationSummary(issues: ZodIssue[]): string {
  const lines = [...new Set(issues.map(friendlyValidationIssue))]
  if (lines.length === 1) return lines[0]!
  return lines.slice(0, 3).join(" ") + (lines.length > 3 ? ` (+${lines.length - 3} more)` : "")
}

function friendlyStepError(stepLabel: string, raw: string): RunErrorDisplay {
  const rejectedReason = inputRejectedReasonFromMessage(raw)
  if (rejectedReason) {
    return {
      title: `"${stepLabel}" rejected the input`,
      message: rejectedReason || "The uploaded or upstream data did not match what this step expects.",
      detail: raw,
      stepLabel,
    }
  }

  const validation = raw.match(/^output failed ([A-Za-z0-9_]+) validation:\s*([\s\S]+)$/)
  if (validation) {
    const structure = validation[1]!
    const body = validation[2]!.trim()
    const issues = parseZodIssues(body)
    if (issues?.length) {
      return {
        title: `"${stepLabel}" could not prepare ${structure.replace(/([A-Z])/g, " $1").trim().toLowerCase()}`,
        message: friendlyValidationSummary(issues),
        detail: raw,
        stepLabel,
      }
    }
    return {
      title: `"${stepLabel}" produced invalid ${structure.replace(/([A-Z])/g, " $1").trim().toLowerCase()}`,
      message: "The step returned data in an unexpected shape. Check that all inputs were uploaded correctly.",
      detail: raw,
      stepLabel,
    }
  }

  if (/custom code failed/i.test(raw)) {
    return {
      title: `"${stepLabel}" custom logic failed`,
      message: "A transform step could not run its code. Try re-running with the sample inputs, or review the step in Pipeline.",
      detail: raw,
      stepLabel,
    }
  }

  if (/validation/i.test(raw) || /schema/i.test(raw)) {
    return {
      title: `"${stepLabel}" failed validation`,
      message: "The step output did not match the expected structure. Check your inputs and try again.",
      detail: raw,
      stepLabel,
    }
  }

  const firstLine = raw.split("\n")[0]?.trim() ?? raw
  return {
    title: `"${stepLabel}" could not finish`,
    message: firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine,
    detail: raw.length > firstLine.length ? raw : undefined,
    stepLabel,
  }
}

export function formatRunErrorForDisplay(run: PipelineRun): RunErrorDisplay | null {
  const step = run.steps.find((s) => s.status === "error")
  if (!step) {
    return run.status === "error" ? { title: "Pipeline could not finish", message: "Something went wrong during the run." } : null
  }

  const check = resolveInputDescriptionCheck(step.inputDescriptionCheck, step.outputPreview)
  if (check?.matches === false) {
    return {
      title: `"${step.label}" rejected the input`,
      message: describeInputDescriptionFailure(check),
      detail: step.outputPreview ?? undefined,
      stepLabel: step.label,
    }
  }

  const raw = step.outputPreview?.trim()
  if (!raw) {
    return {
      title: `"${step.label}" could not finish`,
      message: "This step failed before it could produce output.",
      stepLabel: step.label,
    }
  }

  const prefixed = raw.startsWith(`${step.label}:`) ? raw.slice(step.label.length + 1).trim() : raw
  return friendlyStepError(step.label, prefixed)
}
