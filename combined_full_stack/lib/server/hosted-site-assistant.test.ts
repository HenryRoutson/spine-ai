import { describe, expect, it } from "vitest"
import {
  applyHostedSiteAssistantPatch,
  buildHostedSiteAssistantSystemPrompt,
  buildHostedSiteAssistantUserPrompt,
} from "@/lib/server/hosted-site-assistant"
import { DEFAULT_HOSTED_SITE_HTML, HOSTED_SITE_RUN_SLOT } from "@/lib/hosted-site"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { InputType, ModuleKind, type Project, type ProjectId } from "@/lib/types"

const PROJECT: Project = {
  id: "p1" as ProjectId,
  name: "Invoice Ops",
  kind: "blank",
  createdAt: 1,
  lastOpenedAt: 1,
  documentation: "INTERNAL: do not put on the public page",
  models: [],
  strategies: [],
  modules: [
    {
      id: "mod_in",
      kind: ModuleKind.Input,
      label: "Invoices",
      note: "PDF invoices",
      inputType: InputType.Pdf,
      prompt: "SYSTEM PROMPT SECRET",
      code: "return steal()",
      cached: true,
      avgMs: 0,
      avgCostCents: 0,
    },
    {
      id: "mod_out",
      kind: ModuleKind.Output,
      label: "Ledger",
      cached: true,
      avgMs: 0,
      avgCostCents: 0,
    },
  ],
}

const OPTIONS = {
  ...DEFAULT_HOSTED_SITE_OPTIONS,
  brand: { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Northwind", tagline: "Invoice ops" },
  customHtml: DEFAULT_HOSTED_SITE_HTML,
}

describe("hosted site UI vibe agent prompts", () => {
  it("forbids pipeline/docs edits and only asks for HTML/CSS/brand", () => {
    const system = buildHostedSiteAssistantSystemPrompt()
    expect(system).toMatch(/ONLY change the public webpage/i)
    expect(system).toMatch(/MUST NOT change the pipeline/)
    expect(system).toContain(HOSTED_SITE_RUN_SLOT)
  })

  it("sends page HTML plus a short app summary, not docs/prompts/code", () => {
    const user = buildHostedSiteAssistantUserPrompt({
      project: PROJECT,
      siteOptions: OPTIONS,
      message: "Make a purple hero",
      history: [],
    })
    expect(user).toContain("Northwind")
    expect(user).toContain("Invoices")
    expect(user).toContain(HOSTED_SITE_RUN_SLOT)
    expect(user).toContain("Make a purple hero")
    expect(user).not.toContain("INTERNAL")
    expect(user).not.toContain("SYSTEM PROMPT SECRET")
    expect(user).not.toContain("return steal()")
  })

  it("keeps {{run}} if the model forgets it", () => {
    const next = applyHostedSiteAssistantPatch(OPTIONS, {
      message: "ok",
      customHtml: "<header><h1>{{company}}</h1></header>",
      customCss: null,
      companyName: null,
      tagline: null,
      primaryColor: null,
      accentColor: null,
      backgroundColor: null,
      textColor: null,
      hideSpineFooter: null,
    })
    expect(next.customHtml).toContain(HOSTED_SITE_RUN_SLOT)
    expect(next.brand.companyName).toBe("Northwind")
  })

  it("expands 3-digit assistant colors to #rrggbb", () => {
    const next = applyHostedSiteAssistantPatch(OPTIONS, {
      message: "ok",
      customHtml: null,
      customCss: null,
      companyName: null,
      tagline: null,
      primaryColor: "#abc",
      accentColor: null,
      backgroundColor: null,
      textColor: null,
      hideSpineFooter: null,
    })
    expect(next.brand.primaryColor).toBe("#aabbcc")
  })
})
