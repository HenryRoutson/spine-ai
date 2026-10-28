import { describe, expect, it } from "vitest"
import { shareTargetHasRunnableBackend, shareTargetShowsApi, shareTargetShowsFunding } from "@/lib/share-target"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import type { Project, ProjectId } from "@/lib/types"

const project = {
  id: "p1" as ProjectId,
  name: "P",
  kind: "blank",
  models: [],
  modules: [{ id: "m" }],
  strategies: [],
} as unknown as Project

describe("share target", () => {
  it("shows API only on pipelines", () => {
    expect(shareTargetShowsApi({ kind: "pipeline", project })).toBe(true)
    expect(
      shareTargetShowsApi({
        kind: "website",
        site: { siteOptions: { pipelineBindings: [] } } as unknown as SharedLinkRecord,
        project,
      }),
    ).toBe(false)
  })

  it("hides funding on a page-only website", () => {
    const site = { siteOptions: { pipelineBindings: [] } } as unknown as SharedLinkRecord
    expect(shareTargetHasRunnableBackend({ kind: "website", site })).toBe(false)
    expect(shareTargetShowsFunding({ kind: "website", site })).toBe(false)
    expect(shareTargetShowsFunding({ kind: "pipeline", project })).toBe(true)
  })
})
