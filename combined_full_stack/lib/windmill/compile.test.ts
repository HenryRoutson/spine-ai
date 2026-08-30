import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import { compileProjectToOpenFlow, generateOpenFlowJson } from "@/lib/windmill/compile"
import { generatePipelineExportBundle } from "@/lib/server/pipeline_export_bundle"
import { ModuleKind } from "@/lib/types"
import type { WindmillFlowModule } from "@/lib/windmill/types"

function walk(modules: WindmillFlowModule[]): string[] {
  const types: string[] = []
  for (const m of modules) {
    types.push(m.value.type)
    const v = m.value
    if (v.type === "forloopflow") types.push(...walk(v.modules))
    if (v.type === "branchall") {
      for (const b of v.branches) types.push(...walk(b.modules))
    }
    if (v.type === "branchone") {
      for (const b of v.branches) types.push(...walk(b.modules))
      types.push(...walk(v.default))
    }
  }
  return types
}

describe("OpenFlow compiler", () => {
  it("compiles every seed without throwing", () => {
    const files = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"))
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) {
      const { project } = loadProjectSeed(join(SEEDS_DIR, file))
      const flow = compileProjectToOpenFlow(project)
      expect(flow.summary).toBe(project.name)
      expect(flow.value.modules.length).toBeGreaterThan(0)
      expect(flow.description).toContain("Derived prompts from Zod")
      expect(flow.description).toContain("Quote fields")
    }
  })

  it("emits aiagent output_schema for LLM batch seeds", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"))
    const flow = compileProjectToOpenFlow(project)
    const types = walk(flow.value.modules)
    expect(types).toContain("forloopflow")
    expect(types).toContain("aiagent")
    const json = generateOpenFlowJson(project)
    expect(json).toContain("output_schema")
    expect(json).toContain("JSON Schema")
  })

  it("compiles n8n pieces to bun rawscripts", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "lead_enrich_n8n.json"))
    const flow = compileProjectToOpenFlow(project)
    const types = walk(flow.value.modules)
    expect(types).toContain("rawscript")
    expect(project.modules.some((m) => m.kind === ModuleKind.N8n || m.kind === ModuleKind.Fork)).toBe(true)
    const json = generateOpenFlowJson(project)
    expect(json).toContain("bun")
    expect(json).toContain("n8n")
  })

  it("documents quote click-through as a Spine extra on every compiled flow", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"))
    const flow = compileProjectToOpenFlow(project)
    expect(flow.description).toContain("Quote fields click through")
    expect(flow.description).toContain("deterministic fields")
  })

  it("adds OpenFlow + JSON Schema to the export zip", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"))
    const bundle = generatePipelineExportBundle(project)
    const names = bundle.map((f) => f.filename)
    expect(names.some((n) => n.endsWith("_flow.json"))).toBe(true)
    expect(names.some((n) => n.endsWith("_schema.json"))).toBe(true)
    const flow = bundle.find((f) => f.filename.endsWith("_flow.json"))!
    expect(flow.content).toContain("\"type\": \"aiagent\"")
    const env = bundle.find((f) => f.filename === ".env.example")!
    expect(env.content).toContain("WINDMILL_URL")
    const readme = bundle.find((f) => f.filename === "README.md")!
    expect(readme.content).toContain("Windmill OpenFlow")
  })

  it("maps quote steps to identity (Spine click-to-highlight extra)", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "company_legal_evaluation.json"))
    const json = generateOpenFlowJson(project)
    expect(json).toContain("quote linker")
    expect(json).toContain("\"type\": \"identity\"")
  })

  it("suspends human-review and compiles if-else to branchone", () => {
    const review = loadProjectSeed(join(SEEDS_DIR, "invoice_triage_fork.json")).project
    expect(generateOpenFlowJson(review)).toContain("required_events")
    const ticket = loadProjectSeed(join(SEEDS_DIR, "urgent_ticket.json")).project
    expect(walk(compileProjectToOpenFlow(ticket).value.modules)).toContain("branchone")
  })
})
