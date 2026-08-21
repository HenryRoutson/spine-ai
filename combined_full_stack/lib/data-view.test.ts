import { describe, expect, it } from "vitest"
import { resolveViewer, storyboardFromValue } from "@/lib/data-view"

describe("resolveViewer", () => {
  it("plays VideoClip envelopes", () => {
    const view = resolveViewer({
      value: { doc_id: "sha_abc", filename: "clip.mp4", mime: "video/mp4" },
      outStructureId: "m_builtin_video_clip",
    })
    expect(view.viewerId).toBe("video")
    expect(view.docId).toBe("sha_abc")
  })

  it("plays ImageStill envelopes", () => {
    const view = resolveViewer({
      value: { doc_id: "sha_img", filename: "still.png", mime: "image/png" },
      outStructureId: "m_builtin_image_still",
    })
    expect(view.viewerId).toBe("image")
    expect(view.docId).toBe("sha_img")
  })

  it("falls back to json for plain structs", () => {
    const view = resolveViewer({ value: { prompt: "hi" } })
    expect(view.viewerId).toBe("json")
  })

  it("builds a storyboard from nested stills and a clip", () => {
    const board = storyboardFromValue({
      title: "Alley",
      lower_third: "Mia — courier",
      character: { doc_id: "sha_c", filename: "c.png", mime: "image/png" },
      location: { doc_id: "sha_l", filename: "l.png", mime: "image/png" },
      clip: { doc_id: "sha_v", filename: "c.mp4", mime: "video/mp4" },
    })
    expect(board?.title).toBe("Alley")
    expect(board?.items.map((v) => v.viewerId).sort()).toEqual(["image", "image", "video"])
  })
})
