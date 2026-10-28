// AI : inference tab output panel prefs — stored in localStorage like json-viewer prefs.

import { booleanBrowserPref } from "@/lib/browser-storage-pref"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"

export const INFERENCE_SETTINGS_CHANGED_EVENT = "inference-settings-changed" as const

export const DEFAULT_INFERENCE_OUTPUT_STEPS_ONLY = false
export const DEFAULT_ALLOW_DUPLICATE_RUNS = false

const outputStepsOnlyPref = booleanBrowserPref({
  keySuffix: "inference-output-steps-only",
  defaultValue: DEFAULT_INFERENCE_OUTPUT_STEPS_ONLY,
  changedEvent: INFERENCE_SETTINGS_CHANGED_EVENT,
})

const allowDuplicateRunsPref = booleanBrowserPref({
  keySuffix: "allow-duplicate-runs",
  defaultValue: DEFAULT_ALLOW_DUPLICATE_RUNS,
  changedEvent: INFERENCE_SETTINGS_CHANGED_EVENT,
})

export const INFERENCE_OUTPUT_STEPS_ONLY_KEY = outputStepsOnlyPref.key
export const ALLOW_DUPLICATE_RUNS_KEY = allowDuplicateRunsPref.key

export const readInferenceOutputStepsOnly = outputStepsOnlyPref.read
export const writeInferenceOutputStepsOnly = outputStepsOnlyPref.write

export const readAllowDuplicateRuns = allowDuplicateRunsPref.read
export const writeAllowDuplicateRuns = allowDuplicateRunsPref.write

export function useInferenceOutputStepsOnly(): boolean {
  return useBrowserPrefEvent(INFERENCE_SETTINGS_CHANGED_EVENT, readInferenceOutputStepsOnly)
}

export function useAllowDuplicateRuns(): boolean {
  return useBrowserPrefEvent(INFERENCE_SETTINGS_CHANGED_EVENT, readAllowDuplicateRuns)
}
