// AI : shared SVG / inline status colors for profiling and distribution charts.
// Status colors (ok/err/retry) now come from the user-selected color scheme — import useStatusPalette() instead.

export { useStatusPalette, readStatusPalette } from "@/lib/color-scheme"

// AI : neutral colors — not status-bearing, same across all color schemes.
export const CHART_STAT = "#94a3b8"
export const CHART_AXIS = "#64748b"
