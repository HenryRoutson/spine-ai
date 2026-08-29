import { describe, expect, it } from "vitest"
import { resolve } from "node:path"
import { compileHostedSiteLooksOk } from "@/lib/hosted-site"
import {
  expandSeedHostedSite,
  expandSeedHostedSites,
  websiteNamesFromSeedRaw,
} from "@/lib/example-pipeline-websites"
import { remapWebsiteProjectId } from "@/lib/website-pipelines"
import { allProjectSeeds, loadProjectSeed, projectTemplateSummaryFromFile, SEEDS_DIR } from "@/lib/server/seed"
import type { ProjectId } from "@/lib/types"

describe("example pipeline websites", () => {
  it("expands a compact spec onto the template pipeline id", () => {
    const site = expandSeedHostedSite(
      {
        brand: { companyName: "CounselDesk", tagline: "Cited compliance" },
        kicker: "Legal",
        lede: "Upload filings.",
        cta: "Run",
      },
      "p_legal" as ProjectId,
    )
    expect(site.customHtml).toContain("{{run}}")
    expect(site.customHtml).toContain("Upload filings.")
    expect(site.pipelineBindings).toEqual([{ alias: "run", projectId: "p_legal" }])
    const report = compileHostedSiteLooksOk(site)
    expect(report.ok, report.issues.map((i) => `${i.level}:${i.code} ${i.message}`).join("\n")).toBe(true)
  })

  it("leaves action-only HTML unbound", () => {
    const site = expandSeedHostedSite(
      { customHtml: "{{sql:shared_number}}{{action}}", brand: { companyName: "Shared Number" } },
      "p_double" as ProjectId,
    )
    expect(site.pipelineBindings).toEqual([])
  })

  it("remaps compact sites onto a cloned pipeline", () => {
    const [site] = expandSeedHostedSites(
      { hostedSite: { brand: { companyName: "CounselDesk" }, kicker: "Legal", lede: "Run it.", cta: "Go" } },
      "p_legal" as ProjectId,
    )
    const cloned = remapWebsiteProjectId(site!, "p_legal" as ProjectId, "p_clone" as ProjectId)
    expect(cloned.pipelineBindings[0]?.projectId).toBe("p_clone")
  })

  it("publishes CounselDesk from the legal seed and two skins from expense auditor", () => {
    const legal = loadProjectSeed(resolve(SEEDS_DIR, "company_legal_evaluation.json"))
    expect(legal.hostedSites).toHaveLength(1)
    expect(legal.hostedSite?.brand.companyName).toBe("CounselDesk")
    expect(legal.hostedSites[0]?.pipelineBindings[0]?.projectId).toBe("p_legal")

    const expense = loadProjectSeed(resolve(SEEDS_DIR, "expense_auditor.json"))
    expect(expense.hostedSites.map((s) => s.brand.companyName)).toEqual(["Ledgerly", "Spendly"])
    expect(new Set(expense.hostedSites.map((s) => s.pipelineBindings[0]?.projectId))).toEqual(new Set(["p_expense_audit"]))
    expect(expense.hostedSites[0]?.customCss).toContain("Georgia")
    expect(expense.hostedSites[1]?.customCss).toContain("text-align: left")
  })

  it("every bundled hosted site compiles", () => {
    for (const seed of allProjectSeeds()) {
      for (const site of seed.hostedSites) {
        const report = compileHostedSiteLooksOk(site)
        expect(
          report.ok,
          `${seed.project.name} / ${site.brand.companyName}: ${report.issues.map((i) => `${i.level}:${i.code} ${i.message}`).join("\n")}`,
        ).toBe(true)
      }
    }
  })

  it("website templates list brand names including two expense skins", () => {
    expect(websiteNamesFromSeedRaw({ hostedSites: [{ brand: { companyName: "Ledgerly" } }] })).toEqual(["Ledgerly"])
    const expense = projectTemplateSummaryFromFile("expense_auditor.json")
    expect(expense.hasHostedSite).toBe(true)
    expect(expense.websiteNames).toEqual(["Ledgerly", "Spendly"])
    const legal = projectTemplateSummaryFromFile("company_legal_evaluation.json")
    expect(legal.websiteNames).toEqual(["CounselDesk"])
  })
})
