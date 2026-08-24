import { describe, expect, it } from "vitest"
import { AppWindowId } from "@/lib/app-window-id"
import { BUILDER_AREAS, BUILDER_NAV_ITEMS, BUILDER_WORKSPACE_WINDOW_IDS } from "@/lib/app-nav-config"
import { BUILDER_AREA_WINDOWS, TUI_AREA_IDS } from "@/lib/app-area-windows"
import {
  APP_WINDOW_STEPS,
  AppWindowStep,
  AppWindowStepLabel,
  appWindowIdForStep,
  hotkeyForAppWindowStep,
  windowNavHint,
  windowPanelHeader,
  windowStepHint,
  windowStepHotkey,
} from "@/lib/window-panel-meta"
import { TUI_AREAS, TUI_TAB_HOTKEY, TUI_TAB_META, TUI_TABS, type TuiTab } from "@/lib/core/view"

describe("window chrome parity (GUI headers / nav hints / TUI)", () => {
  it("TUI tabs are every AppWindowId", () => {
    expect([...TUI_TABS].sort()).toEqual([...Object.values(AppWindowId)].sort())
  })

  it("TUI areas are BUILDER_AREA_WINDOWS", () => {
    expect(TUI_AREAS.map((a) => a.id)).toEqual(TUI_AREA_IDS)
    for (const area of TUI_AREAS) {
      expect(area.tabs).toEqual([...BUILDER_AREA_WINDOWS[area.id]])
    }
    expect(BUILDER_AREAS.map((a) => a.id)).toEqual(TUI_AREA_IDS)
  })

  it("TUI title/step/description match GUI windowPanelHeader", () => {
    for (const tab of TUI_TABS) {
      const header = windowPanelHeader(tab)
      expect(TUI_TAB_META[tab].title, tab).toBe(header.title)
      expect(TUI_TAB_META[tab].step, tab).toBe(header.step)
      if (tab === "settings") {
        expect(TUI_TAB_META[tab].description).toMatch(/this session/)
        continue
      }
      expect(TUI_TAB_META[tab].description, tab).toBe(header.description)
    }
  })

  it("nav hints match header step badges and TUI digit keys", () => {
    for (const item of BUILDER_NAV_ITEMS) {
      const header = windowPanelHeader(item.id)
      expect(item.hint, item.id).toBe(windowStepHint(header.step))
      const digit = windowStepHotkey(header.step)
      if (!digit) continue
      expect(TUI_TAB_HOTKEY[item.id as TuiTab], item.id).toBe(digit)
    }
  })

  it("prefetch workspace ids match BUILDER_NAV_ITEMS (no account L0)", () => {
    expect(BUILDER_WORKSPACE_WINDOW_IDS).toEqual(BUILDER_NAV_ITEMS.map((item) => item.id))
  })

  it("AppWindowStep numbers are contiguous and drive Schedule plus later tabs", () => {
    expect(APP_WINDOW_STEPS).toEqual(APP_WINDOW_STEPS.map((_, i) => i + 1))
    expect(windowNavHint(AppWindowId.Schedule)).toMatch(/^\d{2}$/)
    expect(windowPanelHeader(AppWindowId.Schedule).step).toBe(AppWindowStepLabel.Schedule)
    expect(AppWindowStepLabel.Schedule).toBe(`${windowNavHint(AppWindowId.Schedule)} / Schedule`)
    expect(appWindowIdForStep(AppWindowStep.Schedule)).toBe(AppWindowId.Schedule)
    const hotkeys = APP_WINDOW_STEPS.map((step) => hotkeyForAppWindowStep(step))
    expect(new Set(hotkeys).size).toBe(hotkeys.length)
  })
})
