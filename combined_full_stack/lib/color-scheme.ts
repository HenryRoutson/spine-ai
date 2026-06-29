// AI : color scheme preferences for accessibility — covers the three main types of colour blindness.

import { stringBrowserPref } from "@/lib/browser-storage-pref"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"

export type ColorSchemeId = "default" | "deuteranopia" | "tritanopia"

// AI : all hex values and tailwind arbitrary classes are declared statically so Tailwind picks them up at build time.
export type StatusPalette = {
  ok: string
  okStroke: string
  okText: string        // tailwind text-[#hex] class
  err: string
  errStroke: string
  errText: string
  retry: string
  retryStroke: string
  retryText: string
  stat: string          // neutral stat / axis label color (shared across all schemes)
  axis: string
}

type ColorSchemeEntry = {
  label: string
  description: string
  palette: StatusPalette
}

// AI : stat and axis are identical across schemes — they're neutral, not status-bearing.
const NEUTRAL = { stat: "#94a3b8", axis: "#64748b" }

export const COLOR_SCHEMES: Record<ColorSchemeId, ColorSchemeEntry> = {
  default: {
    label: "Default",
    description: "Green = ok, red = error, amber = retry.",
    palette: {
      ok: "#22c55e", okStroke: "#15803d", okText: "text-[#22c55e]",
      err: "#ef4444", errStroke: "#b91c1c", errText: "text-[#ef4444]",
      retry: "#f59e0b", retryStroke: "#b45309", retryText: "text-[#f59e0b]",
      ...NEUTRAL,
    },
  },
  deuteranopia: {
    label: "Deuteranopia / Protanopia",
    description: "Blue = ok, orange = error, violet = retry. For red-green colour blindness.",
    palette: {
      ok: "#3b82f6", okStroke: "#1d4ed8", okText: "text-[#3b82f6]",
      err: "#f97316", errStroke: "#c2410c", errText: "text-[#f97316]",
      retry: "#a855f7", retryStroke: "#7e22ce", retryText: "text-[#a855f7]",
      ...NEUTRAL,
    },
  },
  tritanopia: {
    label: "Tritanopia",
    description: "Teal = ok, magenta = error, amber = retry. For blue-yellow colour blindness.",
    palette: {
      ok: "#0891b2", okStroke: "#0e7490", okText: "text-[#0891b2]",
      err: "#db2777", errStroke: "#9d174d", errText: "text-[#db2777]",
      retry: "#f59e0b", retryStroke: "#b45309", retryText: "text-[#f59e0b]",
      ...NEUTRAL,
    },
  },
}

export const COLOR_SCHEME_IDS: ColorSchemeId[] = ["default", "deuteranopia", "tritanopia"]

export const COLOR_SCHEME_CHANGED_EVENT = "color-scheme-changed" as const
export const DEFAULT_COLOR_SCHEME: ColorSchemeId = "default"

const colorSchemePref = stringBrowserPref<ColorSchemeId>({
  keySuffix: "color-scheme",
  defaultValue: DEFAULT_COLOR_SCHEME,
  changedEvent: COLOR_SCHEME_CHANGED_EVENT,
  isValid: (v): v is ColorSchemeId => (COLOR_SCHEME_IDS as string[]).includes(v),
})

export const readColorScheme = colorSchemePref.read

// AI : writes to localStorage AND applies data-color-scheme on <html> so CSS vars update immediately.
export function writeColorScheme(scheme: ColorSchemeId): void {
  colorSchemePref.write(scheme)
  if (typeof document !== "undefined") {
    document.documentElement.dataset.colorScheme = scheme === DEFAULT_COLOR_SCHEME ? "" : scheme
  }
}

// AI : call once on app init to restore the saved scheme attribute before first paint.
export function applyColorSchemeAttribute(): void {
  if (typeof document === "undefined") return
  const scheme = readColorScheme()
  if (scheme !== DEFAULT_COLOR_SCHEME) {
    document.documentElement.dataset.colorScheme = scheme
  }
}

export function readStatusPalette(): StatusPalette {
  return COLOR_SCHEMES[readColorScheme()].palette
}

export function useStatusPalette(): StatusPalette {
  const schemeId = useBrowserPrefEvent(COLOR_SCHEME_CHANGED_EVENT, readColorScheme)
  return COLOR_SCHEMES[schemeId].palette
}
