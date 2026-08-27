import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { compileHostedSiteReactProject } from "@/lib/hosted-site-react-compile"
import { htmlSiteToReactFiles } from "@/lib/hosted-site-react"
import { instantiateHostedSiteReactApp } from "@/lib/hosted-site-react-runtime"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"

describe("hosted site react compile", () => {
  it("compiles the generated Vite tree and runs edited App.tsx", () => {
    const generated = htmlSiteToReactFiles(
      normalizeHostedSiteOptions({
        customHtml: "<h1>Acme</h1>{{run}}",
        customCss: "h1{color:red}",
      }),
    )
    const compiled = compileHostedSiteReactProject(generated)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.bundle.entry).toBe("src/App.tsx")
    expect(compiled.bundle.css).toContain("h1{color:red}")
    expect(compiled.bundle.css).toContain(".hs-nav")

    const App = instantiateHostedSiteReactApp(compiled.bundle, ({ alias }) => createElement("span", null, `pipe:${alias}`))
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain("Acme")
    expect(html).toContain("pipe:run")
  })

  it("fills brand tokens when compiling", () => {
    const generated = htmlSiteToReactFiles(
      normalizeHostedSiteOptions({
        brand: { companyName: "Demo Site", tagline: "Run attached pipelines" },
        customHtml: "<h1>{{company}}</h1><p>{{tagline}}</p>{{run}}",
      }),
    )
    const compiled = compileHostedSiteReactProject(generated, normalizeHostedSiteOptions({
      brand: { companyName: "Demo Site", tagline: "Run attached pipelines" },
    }))
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const App = instantiateHostedSiteReactApp(compiled.bundle, ({ alias }) => createElement("span", null, alias))
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain("Demo Site")
    expect(html).toContain("Run attached pipelines")
    expect(html).not.toContain("{{company}}")
  })

  it("compiles a hand-edited App that imports a local component", () => {
    const result = compileHostedSiteReactProject([
      {
        path: "src/Hero.tsx",
        contents: `export function Hero() { return <h1>Edited React</h1> }`,
      },
      {
        path: "src/App.tsx",
        contents: `import { Hero } from "./Hero"
import { RunPipeline } from "./components/RunPipeline"

export default function App() {
  return (
    <div>
      <Hero />
      <RunPipeline alias="invoice" />
    </div>
  )
}
`,
      },
      {
        path: "src/components/RunPipeline.tsx",
        contents: `export function RunPipeline({ alias }: { alias: string }) { return <div>{alias}</div> }`,
      },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const App = instantiateHostedSiteReactApp(result.bundle, ({ alias }) => createElement("em", null, alias))
    expect(renderToStaticMarkup(createElement(App))).toContain("Edited React")
    expect(renderToStaticMarkup(createElement(App))).toContain("invoice")
  })

  it("prepends default hosted CSS when the React tree has none", () => {
    const result = compileHostedSiteReactProject([
      {
        path: "src/App.tsx",
        contents: `export default function App() { return <h1>Hi</h1> }`,
      },
      { path: "src/index.css", contents: "/* stub */" },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.bundle.css).toContain(".hs-nav")
    expect(result.bundle.css).toContain(".hs-hero")
  })
})
