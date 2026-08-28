import type {
  hosted_run_input_visibility,
  WebsitePipelineBinding,
} from "@/lib/shared-link-types"
import type { ModuleId } from "@/lib/types"

export type HostedRunInputChrome = Pick<
  WebsitePipelineBinding,
  "visibility" | "inputEditable" | "clearInputAfterRun"
>

export const DEFAULT_HOSTED_RUN_INPUT_CHROME: HostedRunInputChrome = {
  visibility: "auto",
  inputEditable: true,
  clearInputAfterRun: false,
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
  // AI : hidden inputs cannot be edited or cleared in the UI
  if (visibility === "hide") {
    return { visibility, inputEditable: false, clearInputAfterRun: false }
  }
  const inputEditable = rec.inputEditable !== false && rec.editable !== false
  const clearInputAfterRun = rec.clearInputAfterRun === true || rec.clearAfterRun === true
  return { visibility, inputEditable, clearInputAfterRun }
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
