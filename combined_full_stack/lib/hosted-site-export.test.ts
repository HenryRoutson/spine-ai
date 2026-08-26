import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  generateHostedSiteExportFiles,
  HOSTED_APP_ENV_PLACEHOLDERS,
  hostedSiteOptionsForExport,
} from "@/lib/hosted-site-export"
import { DEFAULT_HOSTED_SITE_HTML } from "@/lib/hosted-site"
import { generatePipelineExportBundle } from "@/lib/server/pipeline_export_bundle"
import { generateEnvExample } from "@/lib/server/pipeline_export_setup"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"

function fileOf(files: { filename: string; content: string }[], name: string): string {
  const hit = files.find((f) => f.filename === name)
  expect(hit, `missing ${name}`).toBeTruthy()
  return hit!.content
}

describe("hosted site export files", () => {
  it("emits signed-in app HTML, sign-in kept for later, CSS, and empty env placeholders", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"))
    const siteOptions = {
      ...DEFAULT_HOSTED_SITE_OPTIONS,
      brand: { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Northwind", tagline: "Invoice ops" },
      customHtml: DEFAULT_HOSTED_SITE_HTML,
    }
    const files = generateHostedSiteExportFiles(project, siteOptions)
    const names = files.map((f) => f.filename)
    expect(names).toEqual(["hosted/index.html", "hosted/auth.html", "hosted/styles.css", "hosted/.env.example"])

    const app = fileOf(files, "hosted/index.html")
    expect(app).toContain("hs-nav-account")
    expect(app).toContain("you@company.com")
    expect(app).toContain("Northwind")
    expect(app).toContain("hs-run-slot")
    expect(app).not.toMatch(/href="#signin"/)
    expect(app).not.toMatch(/sk-[A-Za-z0-9]{20,}/)

    const auth = fileOf(files, "hosted/auth.html")
    expect(auth).toContain("Sign in")
    expect(auth).toContain("hs-auth-slot")
    expect(auth).toContain("Northwind")

    const css = fileOf(files, "hosted/styles.css")
    expect(css).toContain(".hs-root")
    expect(css).toContain(".hs-run-slot")
    expect(css).toContain(".hs-nav-account")

    const env = fileOf(files, "hosted/.env.example")
    expect(env).toBe(`${HOSTED_APP_ENV_PLACEHOLDERS}\n`)
    expect(env).toContain('NEXT_PUBLIC_SUPABASE_URL=""')
    expect(env).toContain('CUSTOM_SUPABASE_URL=""')
    expect(env).toContain('CUSTOM_SUPABASE_ANON_KEY=""')
  })

  it("falls back to the project name when brand is empty", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"))
    const options = hostedSiteOptionsForExport(project)
    expect(options.brand.companyName).toBe(project.name)
    expect(options.auth.enabled).toBe(false)
  })

  it("includes hosted files and empty env keys in the pipeline export bundle", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"))
    const bundle = generatePipelineExportBundle(project, {
      ...DEFAULT_HOSTED_SITE_OPTIONS,
      brand: { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Acme" },
      customHtml: DEFAULT_HOSTED_SITE_HTML,
    })
    const names = bundle.map((f) => f.filename)
    expect(names).toContain("hosted/index.html")
    expect(names).toContain("hosted/auth.html")
    expect(names).toContain("hosted/styles.css")
    expect(names).toContain("hosted/.env.example")
    expect(names).toContain(".env.example")
    expect(names).toContain("README.md")

    const rootEnv = fileOf(bundle, ".env.example")
    expect(rootEnv).toContain('NEXT_PUBLIC_SUPABASE_URL=""')
    expect(rootEnv).toContain('CUSTOM_SUPABASE_ANON_KEY=""')
    expect(generateEnvExample(project)).toContain(HOSTED_APP_ENV_PLACEHOLDERS)

    const readme = fileOf(bundle, "README.md")
    expect(readme).toContain("hosted/index.html")
    expect(readme).toContain("hosted/.env.example")
  })

  it("emits one HTML file per extra page as hosted/app.html", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"))
    const files = generateHostedSiteExportFiles(project, {
      ...DEFAULT_HOSTED_SITE_OPTIONS,
      brand: { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName: "Acme" },
      customHtml: "<header><h1>Landing</h1></header>",
      pages: [{ path: "app", html: "<section>{{run}}</section>{{output}}" }],
    })
    const names = files.map((f) => f.filename)
    expect(names).toContain("hosted/index.html")
    expect(names).toContain("hosted/app.html")
    const landing = fileOf(files, "hosted/index.html")
    expect(landing).toContain("Landing")
    const workspace = fileOf(files, "hosted/app.html")
    expect(workspace).toContain("hs-run-slot")
    expect(workspace).toContain("hs-output-slot")
  })
})
