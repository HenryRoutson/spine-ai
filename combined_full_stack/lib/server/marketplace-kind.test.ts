import { describe, expect, it } from "vitest"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import { listingKindFromPersistence } from "./marketplace"
import { withHostedSiteOnSnapshot } from "./shared-link-persist"
import type { Project, ProjectId } from "./types"

const stub: Project = {
  id: "p_site" as ProjectId,
  name: "Acme",
  kind: "page",
  models: [],
  modules: [],
  strategies: [],
}

describe("listingKindFromPersistence", () => {
  it("trusts the kind column when present", () => {
    expect(listingKindFromPersistence("website")).toBe("website")
    expect(listingKindFromPersistence("pipeline")).toBe("pipeline")
    expect(
      listingKindFromPersistence(
        "pipeline",
        withHostedSiteOnSnapshot(stub, normalizeHostedSiteOptions({ brand: { companyName: "Acme" } })),
      ),
    ).toBe("pipeline")
  })

  it("infers website from snapshot.hostedSite when prod lacks marketplace_listings.kind", () => {
    const snap = withHostedSiteOnSnapshot(
      stub,
      normalizeHostedSiteOptions({ brand: { companyName: "Acme Desk" } }),
    )
    expect(listingKindFromPersistence(undefined, snap)).toBe("website")
    expect(listingKindFromPersistence(null, snap)).toBe("website")
    expect(listingKindFromPersistence(undefined, stub)).toBe("pipeline")
  })
})
