import { describe, expect, it } from "vitest"
import { AppWindowId } from "@/lib/app-window-id"
import { guiDefaultWorkspaceWindow, guiWindowAfterSimplified, SIMPLIFIED_WORKSPACE_WINDOW_IDS } from "@/lib/app-nav-config"

describe("guiWindowAfterSimplified", () => {
  it("keeps a website on the page studio, never Inference or Schedule", () => {
    expect(guiWindowAfterSimplified(AppWindowId.Inference, false, true)).toBe(AppWindowId.Share)
    expect(guiWindowAfterSimplified(AppWindowId.Schedule, true, true)).toBe(AppWindowId.Share)
    expect(guiWindowAfterSimplified(AppWindowId.Pipeline, false, true)).toBe(AppWindowId.Share)
    expect(guiWindowAfterSimplified(AppWindowId.Structure, false, true)).toBe(AppWindowId.Share)
    expect(guiWindowAfterSimplified(AppWindowId.Vibe, false, true)).toBe(AppWindowId.Share)
    expect(guiWindowAfterSimplified(AppWindowId.Share, false, true)).toBe(AppWindowId.Share)
  })

  it("still allows Billing and Settings while editing a website", () => {
    expect(guiWindowAfterSimplified(AppWindowId.Billing, false, true)).toBe(AppWindowId.Billing)
    expect(guiWindowAfterSimplified(AppWindowId.Settings, true, true)).toBe(AppWindowId.Settings)
  })

  it("does not remap pipeline chrome when not editing a website", () => {
    expect(guiWindowAfterSimplified(AppWindowId.Inference, true, false)).toBe(AppWindowId.Inference)
    expect(guiWindowAfterSimplified(AppWindowId.Schedule, true, false)).toBe(AppWindowId.Schedule)
    expect(guiWindowAfterSimplified(AppWindowId.Structure, false, false)).toBe(AppWindowId.Structure)
    expect(guiWindowAfterSimplified(AppWindowId.Testing, true, false)).toBe(AppWindowId.Inference)
    expect(guiWindowAfterSimplified(AppWindowId.Vibe, false, false)).toBe(AppWindowId.Inference)
    expect(guiWindowAfterSimplified(AppWindowId.Structure, true, false)).toBe(AppWindowId.Inference)
  })

  it("lands a new pipeline workspace on Inference when simplified", () => {
    expect(guiDefaultWorkspaceWindow(true, false)).toBe(AppWindowId.Inference)
    expect(guiDefaultWorkspaceWindow(false, false)).toBe(AppWindowId.Structure)
    expect(guiDefaultWorkspaceWindow(true, true)).toBe(AppWindowId.Share)
  })

  it("omits Structures from simplified workspace tabs", () => {
    expect(SIMPLIFIED_WORKSPACE_WINDOW_IDS).not.toContain(AppWindowId.Structure)
    expect(SIMPLIFIED_WORKSPACE_WINDOW_IDS).toEqual([
      AppWindowId.Pipeline,
      AppWindowId.Inference,
      AppWindowId.Schedule,
      AppWindowId.Share,
    ])
  })
})
