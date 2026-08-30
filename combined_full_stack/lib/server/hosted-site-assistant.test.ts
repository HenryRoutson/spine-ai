import { describe, expect, it } from "vitest"
import {
  applyHostedSiteAssistantPatch,
  buildHostedSiteAssistantSystemPrompt,
  buildHostedSiteAssistantUserPrompt,
} from "@/lib/server/hosted-site-assistant"
import { DEFAULT_HOSTED_SITE_HTML, DEFAULT_HOSTED_SITE_LANDING_HTML, HOSTED_SITE_AUTH_SLOT, HOSTED_SITE_CHATBOT_SLOT, HOSTED_SITE_DOCS_SLOT, HOSTED_SITE_OUTPUT_SLOT, HOSTED_SITE_RUN_SLOT } from "@/lib/hosted-site"
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
    expect(system).toMatch(/signed-in workspace/i)
    expect(system).toContain(HOSTED_SITE_RUN_SLOT)
    expect(system).toContain(HOSTED_SITE_OUTPUT_SLOT)
    expect(system).toContain(HOSTED_SITE_CHATBOT_SLOT)
    expect(system).toContain(HOSTED_SITE_DOCS_SLOT)
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
      authEnabled: null,
      authProvider: null,
      authHtml: null,
      reactFilePatches: null,
      actions: null,
    })
    expect(next.customHtml).toContain(HOSTED_SITE_RUN_SLOT)
    expect(next.brand.companyName).toBe("Northwind")
  })

  it("does not append {{run}} when the page already has {{action}}", () => {
    const next = applyHostedSiteAssistantPatch(OPTIONS, {
      message: "ok",
      customHtml: "<section>{{sql:shared_number}}{{action}}</section>",
      customCss: null,
      companyName: null,
      tagline: null,
      primaryColor: null,
      accentColor: null,
      backgroundColor: null,
      textColor: null,
      hideSpineFooter: null,
      authEnabled: null,
      authProvider: null,
      authHtml: null,
      reactFilePatches: null,
      actions: null,
    })
    expect(next.customHtml).toContain("{{action}}")
    expect(next.customHtml).not.toContain(HOSTED_SITE_RUN_SLOT)
  })

  it("does not inject {{run}} onto a page-only site", () => {
    const current = {
      ...OPTIONS,
      customHtml: DEFAULT_HOSTED_SITE_LANDING_HTML,
      pipelineBindings: [],
    }
    const next = applyHostedSiteAssistantPatch(current, {
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
      authEnabled: null,
      authProvider: null,
      authHtml: null,
      reactFilePatches: null,
      actions: null,
    })
    expect(next.customHtml).not.toContain(HOSTED_SITE_RUN_SLOT)
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
      authEnabled: null,
      authProvider: null,
      authHtml: null,
      reactFilePatches: null,
      actions: null,
    })
    expect(next.brand.primaryColor).toBe("#aabbcc")
  })

  it("turns on the sign-in page and keeps an {{auth}} slot", () => {
    const next = applyHostedSiteAssistantPatch(OPTIONS, {
      message: "ok",
      customHtml: null,
      customCss: null,
      companyName: null,
      tagline: null,
      primaryColor: null,
      accentColor: null,
      backgroundColor: null,
      textColor: null,
      hideSpineFooter: null,
      authEnabled: true,
      authProvider: "spine",
      authHtml: "<section><h1>Welcome</h1></section>",
      reactFilePatches: null,
      actions: null,
    })
    expect(next.auth.enabled).toBe(true)
    expect(next.authHtml).toContain(HOSTED_SITE_AUTH_SLOT)
  })

  it("applies vibe-configured SQL actions", () => {
    const next = applyHostedSiteAssistantPatch(OPTIONS, {
      message: "ok",
      customHtml: "{{sql:todo}}{{action:add}}",
      customCss: null,
      companyName: null,
      tagline: null,
      primaryColor: null,
      accentColor: null,
      backgroundColor: null,
      textColor: null,
      hideSpineFooter: null,
      authEnabled: null,
      authProvider: null,
      authHtml: null,
      reactFilePatches: null,
      actions: [
        {
          alias: "add",
          label: "Add todo",
          title: "Add",
          table: "todo",
          pipelineAlias: null,
          functionId: "fn_add",
          payload: { action: "add" },
        },
      ],
    })
    expect(next.actions).toEqual([
      {
        alias: "add",
        label: "Add todo",
        title: "Add",
        table: "todo",
        pipelineAlias: undefined,
        functionId: "fn_add",
        payload: { action: "add" },
      },
    ])
    expect(next.customHtml).toContain("{{action:add}}")
  })

  it("keeps pipeline bindings and merges react file patches", () => {
    const current = {
      ...OPTIONS,
      runtime: "react" as const,
      pipelineBindings: [{ alias: "run" as const, projectId: PROJECT.id }],
      reactFiles: [{ path: "src/App.tsx", contents: "export default function App(){return null}" }],
    }
    const next = applyHostedSiteAssistantPatch(current, {
      message: "ok",
      customHtml: "<h1>should not apply</h1>",
      customCss: null,
      companyName: null,
      tagline: null,
      primaryColor: null,
      accentColor: null,
      backgroundColor: null,
      textColor: null,
      hideSpineFooter: null,
      authEnabled: null,
      authProvider: null,
      authHtml: null,
      reactFilePatches: [{ path: "src/App.tsx", contents: "export default function App(){return <h1>Hi</h1>}" }],
    })
    expect(next.runtime).toBe("react")
    expect(next.pipelineBindings.map((b) => ({ alias: b.alias, projectId: b.projectId }))).toEqual(
      current.pipelineBindings,
    )
    expect(next.customHtml).toBe(OPTIONS.customHtml)
    expect(next.reactFiles.find((f) => f.path === "src/App.tsx")?.contents).toContain("Hi")
  })

  it("react system prompt asks for file patches, not HTML slots", () => {
    const system = buildHostedSiteAssistantSystemPrompt("react")
    expect(system).toMatch(/reactFilePatches/)
    expect(system).toContain("RunPipeline")
    expect(system).toContain("HostedSlot")
    expect(system).toContain("spine-api.d.ts")
    expect(system).not.toContain(HOSTED_SITE_RUN_SLOT)
  })

  it("react user prompt includes the typed run contract, not pipeline internals", () => {
    const user = buildHostedSiteAssistantUserPrompt({
      project: PROJECT,
      siteOptions: {
        ...OPTIONS,
        runtime: "react",
        pipelineBindings: [{ alias: "run", projectId: PROJECT.id }],
        reactFiles: [{ path: "src/App.tsx", contents: "export default function App(){return null}" }],
      },
      message: "Make a purple hero",
      history: [],
    })
    expect(user).toContain("runPipeline")
    expect(user).toContain("spine-api.d.ts")
    expect(user).toContain("Make a purple hero")
    expect(user).not.toContain("INTERNAL")
    expect(user).not.toContain("SYSTEM PROMPT SECRET")
    expect(user).not.toContain("return steal()")
  })
})
