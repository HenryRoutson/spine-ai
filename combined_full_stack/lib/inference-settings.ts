// AI : inference tab output panel prefs — stored in localStorage like json-viewer prefs.

import { appStorageKey } from "@/lib/storage-keys"

export const INFERENCE_OUTPUT_STEPS_ONLY_KEY = appStorageKey("inference-output-steps-only")
export const INFERENCE_SETTINGS_CHANGED_EVENT = "inference-settings-changed" as const

export const DEFAULT_INFERENCE_OUTPUT_STEPS_ONLY = false

export function readInferenceOutputStepsOnly(): boolean {
  if (typeof window === "undefined") return DEFAULT_INFERENCE_OUTPUT_STEPS_ONLY
  try {
    const v = localStorage.getItem(INFERENCE_OUTPUT_STEPS_ONLY_KEY)
    if (v === "true") return true
    if (v === "false") return false
  } catch {
    /* ignore */
  }
  return DEFAULT_INFERENCE_OUTPUT_STEPS_ONLY
}

export function writeInferenceOutputStepsOnly(onlyOutputSteps: boolean): void {
  localStorage.setItem(INFERENCE_OUTPUT_STEPS_ONLY_KEY, onlyOutputSteps ? "true" : "false")
  window.dispatchEvent(new Event(INFERENCE_SETTINGS_CHANGED_EVENT))
}
