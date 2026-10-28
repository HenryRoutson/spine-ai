import { describe, expect, it } from "vitest"
import { parseCreatedProjectResponse } from "@/lib/created-project-response"
import type { Project, ProjectId } from "@/lib/types"
import type { SharedLinkRecord } from "@/lib/shared-link-types"

const project: Project = {
  id: "p_clone" as ProjectId,
  name: "CounselDesk 1",
  kind: "legal-compliance",
  models: [],
  modules: [],
  strategies: [],
}

const site = { id: "site_abc123def456", name: "CounselDesk" } as SharedLinkRecord

describe("parseCreatedProjectResponse", () => {
  it("reads { project, sites, siteError } from POST /api/projects", () => {
    const parsed = parseCreatedProjectResponse({
      project,
      sites: [site],
      siteError: "hosted site auto-publish failed",
    })
    expect(parsed.project.id).toBe("p_clone")
    expect(parsed.project).not.toHaveProperty("sites")
    expect(parsed.sites).toEqual([site])
    expect(parsed.siteError).toBe("hosted site auto-publish failed")
  })

  it("accepts a bare Project so older responses still ingest", () => {
    const parsed = parseCreatedProjectResponse(project)
    expect(parsed.project.id).toBe("p_clone")
    expect(parsed.sites).toEqual([])
    expect(parsed.siteError).toBeUndefined()
  })

  it("strips sites off a flat Project+sites payload before ingest", () => {
    const parsed = parseCreatedProjectResponse({ ...project, sites: [site] })
    expect(parsed.project.id).toBe("p_clone")
    expect(parsed.project).not.toHaveProperty("sites")
    expect(parsed.sites).toEqual([site])
  })

  it("rejects a non-project body", () => {
    expect(() => parseCreatedProjectResponse({ sites: [] })).toThrow(/Invalid create project/)
  })
})
