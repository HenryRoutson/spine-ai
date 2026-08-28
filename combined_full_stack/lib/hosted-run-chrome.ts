import type {
  hosted_run_input_visibility,
  hosted_run_output_view,
  WebsitePipelineBinding,
} from "@/lib/shared-link-types"
import { parseOutputJson } from "@/lib/data-view"
import type { ModuleId } from "@/lib/types"

export type HostedRunInputChrome = Pick<
  WebsitePipelineBinding,
  "visibility" | "inputEditable" | "clearInputAfterRun" | "runLabel" | "outputView"
>

export type hosted_resolved_output_view = "table" | "json" | "metric"

export const DEFAULT_HOSTED_RUN_BUTTON_LABEL = "Run pipeline"

export const DEFAULT_HOSTED_RUN_INPUT_CHROME: HostedRunInputChrome = {
  visibility: "auto",
  inputEditable: true,
  clearInputAfterRun: false,
  runLabel: "",
  outputView: "auto",
}

// AI : hosted {{run}} chrome — hide upload jargon when the visitor has nothing to provide.

export function hostedRunHidesInputSlots(
  inputModuleIds: ModuleId[],
  defaultDocs: { moduleId: ModuleId }[],
): boolean {
  if (inputModuleIds.length === 0) return true
  return inputModuleIds.every((id) => defaultDocs.some((d) => d.moduleId === id))
}

export function normalizeHostedRunInputChrome(raw: unknown): HostedRunInputChrome {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const visibility: hosted_run_input_visibility =
    rec.visibility === "show" || rec.showInput === true
      ? "show"
      : rec.visibility === "hide" || rec.showInput === false
        ? "hide"
        : rec.visibility === "auto"
          ? "auto"
          : DEFAULT_HOSTED_RUN_INPUT_CHROME.visibility
  const runLabel = typeof rec.runLabel === "string" ? rec.runLabel.trim().slice(0, 40) : ""
  const outputView: hosted_run_output_view =
    rec.outputView === "table" || rec.outputView === "json" || rec.outputView === "metric"
      ? rec.outputView
      : DEFAULT_HOSTED_RUN_INPUT_CHROME.outputView
  // AI : hidden inputs cannot be edited or cleared in the UI
  if (visibility === "hide") {
    return { visibility, inputEditable: false, clearInputAfterRun: false, runLabel, outputView }
  }
  const inputEditable = rec.inputEditable !== false && rec.editable !== false
  const clearInputAfterRun = rec.clearInputAfterRun === true || rec.clearAfterRun === true
  return { visibility, inputEditable, clearInputAfterRun, runLabel, outputView }
}

export function hostedRunIdleButtonLabel(chrome: HostedRunInputChrome): string {
  return chrome.runLabel.trim() || DEFAULT_HOSTED_RUN_BUTTON_LABEL
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function extractHostedMetric(json: string): { label: string; text: string } | null {
  const value = parseOutputJson(json)
  if (typeof value === "number" || typeof value === "boolean") {
    return { label: "", text: String(value) }
  }
  const rec = asRecord(value)
  if (!rec) return null
  const keys = Object.keys(rec)
  if (keys.length !== 1) return null
  const label = keys[0] ?? ""
  const inner = rec[label]
  if (typeof inner === "number" || typeof inner === "boolean" || typeof inner === "string") {
    return { label, text: String(inner) }
  }
  return null
}

export function deriveHostedOutputView(args: {
  preference: hosted_run_output_view
  json: string
}): hosted_resolved_output_view {
  const metric = extractHostedMetric(args.json)
  if (args.preference === "json") return "json"
  if (args.preference === "table") return "table"
  if (args.preference === "metric") return metric ? "metric" : "table"
  if (metric) return "metric"
  const value = parseOutputJson(args.json)
  if (Array.isArray(value) || asRecord(value)) return "table"
  return "json"
}

export function hostedRunShowsInputSlots(args: {
  chrome: HostedRunInputChrome
  inputModuleIds: ModuleId[]
  defaultDocs: { moduleId: ModuleId }[]
  compact: boolean
}): boolean {
  if (args.inputModuleIds.length === 0) return false
  if (!args.compact) return true
  if (args.chrome.visibility === "show") return true
  if (args.chrome.visibility === "hide") return false
  return !hostedRunHidesInputSlots(args.inputModuleIds, args.defaultDocs)
}

export function hostedRunAllowsChangeJson(args: {
  chrome: HostedRunInputChrome
  inputModuleIds: ModuleId[]
  defaultDocs: { moduleId: ModuleId }[]
  compact: boolean
}): boolean {
  if (!args.compact || args.chrome.visibility !== "auto") return false
  if (!args.chrome.inputEditable) return false
  return args.inputModuleIds.length > 0 && hostedRunHidesInputSlots(args.inputModuleIds, args.defaultDocs)
}
