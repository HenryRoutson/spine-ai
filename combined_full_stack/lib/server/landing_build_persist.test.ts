import { describe, expect, it } from "vitest"
import {
  isValidLandingBuildId,
  landingBuildDiagnosticJson,
  landingBuildFromDiagnosticJson,
  parseLandingBuildPayload,
} from "@/lib/server/landing_build_persist"
import type { Project, ProjectId } from "@/lib/server/types"

const stub = {
  id: "p_land_abc123" as ProjectId,
  name: "Triage",
  kind: "ops",
  models: [],
  modules: [],
  strategies: [],
} as unknown as Project

describe("landing build persist payload", () => {
  it("accepts p_land_ ids only", () => {
    expect(isValidLandingBuildId("p_land_abc123")).toBe(true)
    expect(isValidLandingBuildId("p_legal")).toBe(false)
    expect(isValidLandingBuildId("../../secret")).toBe(false)
  })

  it("parses wrapped project + docs", () => {
    const bundle = parseLandingBuildPayload({
      project: stub,
      docs: [{ ref: { id: "sha_1", name: "t.txt", type: "text", label: "inference", sizeKb: 1, uploadedAt: 1, preview: "hi" }, content: "hello" }],
    })
    expect(bundle?.project.id).toBe("p_land_abc123")
    expect(bundle?.docs[0]?.content).toBe("hello")
  })

  it("parses legacy bare project JSON", () => {
    const bundle = parseLandingBuildPayload(stub)
    expect(bundle?.project.id).toBe("p_land_abc123")
    expect(bundle?.docs).toEqual([])
  })

  it("rejects junk", () => {
    expect(parseLandingBuildPayload(null)).toBeNull()
    expect(parseLandingBuildPayload({ docs: [] })).toBeNull()
  })

  it("unwraps landingBuild from landing_page_calls.diagnostic_json", () => {
    const wrapped = landingBuildDiagnosticJson({
      project: stub,
      docs: [],
    })
    expect(landingBuildFromDiagnosticJson(wrapped)?.project.id).toBe("p_land_abc123")
    expect(landingBuildFromDiagnosticJson({ other: true })).toBeNull()
  })
})
