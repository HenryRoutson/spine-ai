import { describe, expect, it } from "vitest"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { Project, ProjectId } from "./types"
import {
  persistOmittingUnknownColumns,
  schemaCacheMissingColumn,
  siteOptionsFromPersistence,
  stripHostedSiteFromSnapshot,
  withHostedSiteOnSnapshot,
} from "./shared-link-persist"

const prodSchemaCacheErr =
  "Could not find the 'site_options' column of 'shared_links' in the schema cache"

const stub: Project = {
  id: "p_site" as ProjectId,
  name: "Acme",
  kind: "page",
  models: [],
  modules: [],
  strategies: [],
}

const siteOptions = normalizeHostedSiteOptions({
  brand: { companyName: "Acme Desk" },
  customHtml: "<h1>Hi</h1>",
})

describe("schemaCacheMissingColumn", () => {
  it("parses the prod PostgREST schema-cache error", () => {
    expect(schemaCacheMissingColumn({ message: prodSchemaCacheErr, code: "PGRST204" })).toBe(
      "site_options",
    )
  })

  it("parses a postgres missing-column error", () => {
    expect(
      schemaCacheMissingColumn({
        message: 'column "viewer_markdown" of relation "shared_links" does not exist',
      }),
    ).toBe("viewer_markdown")
  })

  it("returns null for unrelated errors", () => {
    expect(schemaCacheMissingColumn({ message: "null value in column \"project_id\"" })).toBeNull()
  })
})

describe("siteOptionsFromPersistence", () => {
  it("prefers a populated site_options column", () => {
    const fromCol = normalizeHostedSiteOptions({ brand: { companyName: "Column" } })
    const snap = withHostedSiteOnSnapshot(stub, siteOptions)
    expect(siteOptionsFromPersistence(fromCol, snap).brand.companyName).toBe("Column")
  })

  it("reads hostedSite from snapshot when the column is missing or empty", () => {
    const snap = withHostedSiteOnSnapshot(stub, siteOptions)
    expect(siteOptionsFromPersistence(undefined, snap).brand.companyName).toBe("Acme Desk")
    expect(siteOptionsFromPersistence({}, snap).customHtml).toBe("<h1>Hi</h1>")
  })
})

describe("stripHostedSiteFromSnapshot", () => {
  it("drops hostedSite so the snapshot stays a Project", () => {
    const snap = withHostedSiteOnSnapshot(stub, siteOptions)
    expect(snap.hostedSite?.brand.companyName).toBe("Acme Desk")
    expect(stripHostedSiteFromSnapshot(snap)).not.toHaveProperty("hostedSite")
    expect(stripHostedSiteFromSnapshot(snap).name).toBe("Acme")
  })
})

describe("persistOmittingUnknownColumns", () => {
  it("retries without site_options after the prod schema-cache error", async () => {
    const seen: string[][] = []
    const result = await persistOmittingUnknownColumns(async (row) => {
      seen.push(Object.keys(row).sort())
      if ("site_options" in row) {
        return { error: { message: prodSchemaCacheErr, code: "PGRST204" } }
      }
      return { error: null }
    }, {
      id: "site_abc",
      snapshot: withHostedSiteOnSnapshot(stub, siteOptions),
      site_options: siteOptions,
    })
    expect(result.error).toBeNull()
    expect(seen).toEqual([
      ["id", "site_options", "snapshot"],
      ["id", "snapshot"],
    ])
  })

  it("stops when the remaining payload is empty", async () => {
    const result = await persistOmittingUnknownColumns(async () => {
      return { error: { message: prodSchemaCacheErr } }
    }, { site_options: siteOptions })
    expect(result.error?.message).toContain("site_options")
  })

  it("strips several unknown columns then succeeds", async () => {
    const result = await persistOmittingUnknownColumns(async (row) => {
      if ("site_options" in row) {
        return { error: { message: prodSchemaCacheErr } }
      }
      if ("viewer_markdown" in row) {
        return {
          error: {
            message: "Could not find the 'viewer_markdown' column of 'shared_links' in the schema cache",
          },
        }
      }
      expect(row).toEqual({ id: "site_abc", snapshot: stub })
      return { error: null }
    }, {
      id: "site_abc",
      snapshot: stub,
      site_options: siteOptions,
      viewer_markdown: "",
    })
    expect(result.error).toBeNull()
  })
})
