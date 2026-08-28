import { describe, expect, it } from "vitest"
import { htmlSiteToReactFiles, parseReactPreviewTree } from "@/lib/hosted-site-react"
import { splitHostedSiteSlots } from "@/lib/hosted-site-slots"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import { DEFAULT_HOSTED_SITE_HTML, DEFAULT_HOSTED_SITE_LANDING_HTML } from "@/lib/hosted-site-defaults"
import {
  bindingsFromProjectIds,
  hostedSiteOptionsForCreate,
  insertWebsitePipelineInCode,
  listedWebsitePipelineBindings,
  normalizeWebsitePipelineBindings,
  resolveWebsitePipelineBindings,
  stripWebsitePipelineFromCode,
  websiteBoundProjectIds,
} from "@/lib/website-pipelines"
import type { ProjectId } from "@/lib/types"

const P1 = "p1" as ProjectId
const P2 = "p2" as ProjectId

describe("website pipeline bindings", () => {
  it("treats stored empty bindings as no pipelines; viewer still defaults to primary", () => {
    expect(listedWebsitePipelineBindings([])).toEqual([])
    expect(websiteBoundProjectIds(P1, [])).toEqual([])
    expect(resolveWebsitePipelineBindings(P1, [])).toEqual([{ alias: "run", projectId: P1 }])
  })

  it("mints landing HTML when no pipelines are selected", () => {
    const none = hostedSiteOptionsForCreate({ name: "Acme", pipelineIds: [], projects: [] })
    expect(none.pipelineBindings).toEqual([])
    expect(none.customHtml).toBe(DEFAULT_HOSTED_SITE_LANDING_HTML)
    expect(none.customHtml).not.toContain("{{run}}")
    const withRun = hostedSiteOptionsForCreate({
      name: "Acme",
      pipelineIds: [P1],
      projects: [{ id: P1, name: "Extract" }],
    })
    expect(withRun.pipelineBindings).toEqual([{ alias: "run", projectId: P1 }])
    expect(withRun.customHtml).toBe(DEFAULT_HOSTED_SITE_HTML)
  })

  it("keeps extra pipelines and unique aliases", () => {
    const bindings = normalizeWebsitePipelineBindings([
      { alias: "run", projectId: P1 },
      { alias: "invoice", projectId: P2 },
      { alias: "invoice", projectId: "p3" },
    ])
    expect(bindings).toEqual([
      { alias: "run", projectId: P1 },
      { alias: "invoice", projectId: P2 },
      { alias: "p3", projectId: "p3" },
    ])
  })

  it("builds bindings from selected project ids", () => {
    const next = bindingsFromProjectIds([P1, P2], [
      { id: P1, name: "Extract" },
      { id: P2, name: "Invoice OCR" },
    ])
    expect(next.map((b) => b.alias)).toEqual(["run", "invoice-ocr"])
  })
})

describe("named run slots", () => {
  it("parses {{run:alias}} without breaking {{run}}", () => {
    const segs = splitHostedSiteSlots("<h1>Hi</h1>{{run}}<hr>{{run:invoice}}")
    expect(segs).toEqual([
      { kind: "html", html: "<h1>Hi</h1>" },
      { kind: "slot", slot: "run" },
      { kind: "html", html: "<hr>" },
      { kind: "slot", slot: "run", alias: "invoice" },
    ])
  })
})

describe("html to react conversion", () => {
  it("emits a Vite-style tree with RunPipeline", () => {
    const files = htmlSiteToReactFiles(
      normalizeHostedSiteOptions({
        customHtml: "<h1>Acme</h1>{{run}}{{run:invoice}}",
        customCss: "h1{color:red}",
      }),
    )
    const app = files.find((f) => f.path === "src/App.tsx")?.contents ?? ""
    expect(app).toContain("RunPipeline")
    expect(app).toContain("invoice")
    expect(files.some((f) => f.path === "src/components/RunPipeline.tsx")).toBe(true)
    expect(files.some((f) => f.path === "src/components/HostedSlot.tsx")).toBe(true)
    expect(files.some((f) => f.path === "package.json")).toBe(true)
    expect(files.some((f) => f.path === "vite.config.ts")).toBe(true)
    const tree = parseReactPreviewTree(files)
    expect(tree.css).toContain("h1{color:red}")
    expect(tree.nodes.some((n) => n.kind === "run" && n.alias === "run")).toBe(true)
    expect(tree.nodes.some((n) => n.kind === "run" && n.alias === "invoice")).toBe(true)
  })
})

describe("hosted site options normalize", () => {
  it("defaults runtime to html and keeps bindings", () => {
    const next = normalizeHostedSiteOptions({
      pipelineBindings: [{ alias: "run", projectId: P1 }],
      runtime: "react",
      reactFiles: [{ path: "src/App.tsx", contents: "export default function App(){return null}" }],
    })
    expect(next.runtime).toBe("react")
    expect(next.pipelineBindings).toEqual([{ alias: "run", projectId: P1 }])
    expect(next.reactFiles[0]?.path).toBe("src/App.tsx")
  })
})

describe("pipeline widgets in page code", () => {
  it("strips named run slots from HTML and React", () => {
    const options = normalizeHostedSiteOptions({
      customHtml: "<h1>Hi</h1>{{run}}<hr>{{run:invoice}}",
      reactFiles: [
        {
          path: "src/App.tsx",
          contents: `const parts = [
  { kind: "html", html: "<h1>Hi</h1>" },
  { kind: "run", alias: "run" },
  { kind: "run", alias: "invoice" },
] as const
export default function App() { return <RunPipeline alias="invoice" /> }
`,
        },
      ],
    })
    const next = stripWebsitePipelineFromCode(options, "invoice")
    expect(next.customHtml).toContain("{{run}}")
    expect(next.customHtml).not.toContain("{{run:invoice}}")
    expect(next.reactFiles[0]?.contents).toContain('alias: "run"')
    expect(next.reactFiles[0]?.contents).not.toContain("invoice")
  })

  it("inserts a named run widget into HTML and App.tsx", () => {
    const options = normalizeHostedSiteOptions({
      customHtml: "<h1>Hi</h1>{{run}}",
      reactFiles: [
        {
          path: "src/App.tsx",
          contents: `const parts = [
  { kind: "run", alias: "run" },
] as const
`,
        },
      ],
    })
    const next = insertWebsitePipelineInCode(options, "invoice")
    expect(next.customHtml).toContain("{{run:invoice}}")
    expect(next.reactFiles[0]?.contents).toContain('alias: "invoice"')
  })
})
