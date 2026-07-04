// AI : persisted leading-pane widths for app nav + every tab's sidebar / split panels.

import { appStorageKey } from "@/lib/storage-keys"
import { useBrowserPrefEvent } from "@/lib/use-browser-pref-event"

export const LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT = "layout-split-settings-changed" as const

type pixel_width = number

type SplitDef = {
  keySuffix: string
  defaultWidth: pixel_width
  min: pixel_width
  max: pixel_width
}

function readClampedWidth(key: string, fallback: pixel_width, min: pixel_width, max: pixel_width): pixel_width {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    if (Number.isFinite(n)) return Math.min(max, Math.max(min, n)) as pixel_width
  } catch {
    /* ignore */
  }
  return fallback
}

function writeWidth(key: string, width: pixel_width, min: pixel_width, max: pixel_width): void {
  localStorage.setItem(key, String(Math.min(max, Math.max(min, width))))
  window.dispatchEvent(new Event(LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT))
}

function defineSplit(def: SplitDef) {
  const key = appStorageKey(def.keySuffix)
  return {
    key,
    min: def.min,
    max: def.max,
    defaultWidth: def.defaultWidth,
    read: (): pixel_width => readClampedWidth(key, def.defaultWidth, def.min, def.max),
    write: (width: pixel_width): void => writeWidth(key, width, def.min, def.max),
  }
}

export const navSplit = defineSplit({
  keySuffix: "nav-width",
  defaultWidth: 176,
  min: 56,
  max: 280,
})

// AI : below this width the tab rail is icon-only — no labels or hint numbers.
export const NAV_ICON_ONLY_MAX_WIDTH = 128 as pixel_width

export const structureSidebarSplit = defineSplit({
  keySuffix: "structure-sidebar-width",
  defaultWidth: 224,
  min: 180,
  max: 420,
})

export const pipelineCanvasSplit = defineSplit({
  keySuffix: "pipeline-canvas-width",
  defaultWidth: 640,
  min: 360,
  max: 960,
})

export const testingSidebarSplit = defineSplit({
  keySuffix: "testing-sidebar-width",
  defaultWidth: 320,
  min: 200,
  max: 560,
})

export const testingCompareSplit = defineSplit({
  keySuffix: "testing-compare-width",
  defaultWidth: 420,
  min: 240,
  max: 900,
})

export const inferenceSidebarSplit = defineSplit({
  keySuffix: "inference-sidebar-width",
  defaultWidth: 320,
  min: 200,
  max: 560,
})

export const loggingSidebarSplit = defineSplit({
  keySuffix: "logging-sidebar-width",
  defaultWidth: 340,
  min: 240,
  max: 560,
})

export const loggingPipelineCanvasSplit = defineSplit({
  keySuffix: "logging-pipeline-canvas-width",
  defaultWidth: 560,
  min: 320,
  max: 900,
})

export const docsEditorSplit = defineSplit({
  keySuffix: "docs-editor-width",
  defaultWidth: 480,
  min: 280,
  max: 900,
})

export const cacheListSplit = defineSplit({
  keySuffix: "cache-list-width",
  defaultWidth: 420,
  min: 280,
  max: 640,
})

export const settingsNavSplit = defineSplit({
  keySuffix: "settings-nav-width",
  defaultWidth: 200,
  min: 160,
  max: 320,
})

export function useLayoutSplitWidth(read: () => pixel_width): pixel_width {
  return useBrowserPrefEvent(LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT, read)
}
