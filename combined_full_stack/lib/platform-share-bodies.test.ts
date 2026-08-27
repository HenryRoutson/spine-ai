import { describe, expect, it } from "vitest"
import { z } from "zod"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { SharedLinkFundingMode, type ProjectId } from "@/lib/types"
import { absoluteShareUrl, platformShareBodies } from "@/lib/platform-share-bodies"

const PROJECT_ID = "p_spine_in_spine" as ProjectId

// AI : mirrors createSharedLinkBodySchema / createHostedApiBodySchema `.strict()` top-level keys
// so this test stays out of the api_schemas → rate_limit import graph.
const siteBodySchema = z
  .object({
    projectId: z.string().min(1),
    kind: z.literal("site"),
    fundingMode: z.enum(["sharer_pays", "viewer_pays", "viewer_signs_in"]).optional(),
    siteOptions: z.object({ brand: z.object({ companyName: z.string().optional() }).passthrough() }).passthrough(),
  })
  .strict()

const linkBodySchema = z
  .object({
    projectId: z.string().min(1),
    fundingMode: z.enum(["sharer_pays", "viewer_pays", "viewer_signs_in"]).optional(),
  })
  .strict()

const apiBodySchema = z
  .object({
    projectId: z.string().min(1),
  })
  .strict()

describe("platformShareBodies", () => {
  it("matches the strict site / link / API create schemas", () => {
    const bodies = platformShareBodies({
      projectId: PROJECT_ID,
      name: "Spine in Spine",
    })
    expect(siteBodySchema.safeParse(bodies.site).success).toBe(true)
    expect(linkBodySchema.safeParse(bodies.link).success).toBe(true)
    expect(apiBodySchema.safeParse(bodies.api).success).toBe(true)
    expect(bodies.site.kind).toBe("site")
    expect(bodies.site.siteOptions.brand.companyName).toBe("Spine in Spine")
    expect(bodies.site.fundingMode).toBe(SharedLinkFundingMode.SharerPays)
    expect("name" in bodies.site).toBe(false)
    expect("name" in bodies.link).toBe(false)
    expect("name" in bodies.api).toBe(false)
  })

  it("stamps the display name onto existing site brand without adding unknown keys", () => {
    const bodies = platformShareBodies({
      projectId: PROJECT_ID,
      name: "Acme Desk",
      siteOptions: {
        ...DEFAULT_HOSTED_SITE_OPTIONS,
        brand: { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Old", tagline: "Run it" },
        customHtml: "<h1>Hi</h1>{{run}}",
      },
    })
    expect(siteBodySchema.safeParse(bodies.site).success).toBe(true)
    expect(bodies.site.siteOptions.brand.companyName).toBe("Acme Desk")
    expect(bodies.site.siteOptions.brand.tagline).toBe("Run it")
    expect(bodies.site.siteOptions.customHtml).toContain("{{run}}")
  })

  it("rejects the old hub payload that sent a name field", () => {
    expect(
      siteBodySchema.safeParse({
        projectId: PROJECT_ID,
        name: "Spine — Website",
        fundingMode: SharedLinkFundingMode.SharerPays,
        siteOptions: { brand: { companyName: "Spine" } },
      }).success,
    ).toBe(false)

    expect(
      linkBodySchema.safeParse({
        projectId: PROJECT_ID,
        name: "Spine — Run link",
        fundingMode: SharedLinkFundingMode.SharerPays,
      }).success,
    ).toBe(false)

    expect(
      apiBodySchema.safeParse({
        projectId: PROJECT_ID,
        name: "Spine — API",
      }).success,
    ).toBe(false)
  })
})

describe("absoluteShareUrl", () => {
  it("prefixes relative deploy paths", () => {
    expect(absoluteShareUrl("/site/site_abc", "http://localhost:3000")).toBe(
      "http://localhost:3000/site/site_abc",
    )
    expect(absoluteShareUrl("https://example.com/run/x", "http://localhost:3000")).toBe(
      "https://example.com/run/x",
    )
  })
})
