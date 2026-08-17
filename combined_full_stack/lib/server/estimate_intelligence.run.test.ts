import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { customCodeEntriesForModule } from "@/lib/custom_code_entries"
import { runCustomCodeWithFallbacks } from "@/lib/custom_code"
import { validateInferenceDocContent } from "@/lib/inference-validity"
import { SEEDS_DIR } from "@/lib/server/seed"
import {
  loadSeedForParity,
  parityCasesForSeed,
  runUiParityTrace,
  withSeedLlmEnv,
} from "@/lib/server/pipeline_export_parity"
import { materializeInputDocument, validateStepOutput } from "@/lib/server/structure"
import { migrateProjectModules } from "@/lib/server/validity"
import { CustomCodeLanguage, InputType, type DocRef, type PipelineModule } from "@/lib/types"

const seedPath = resolve(SEEDS_DIR, "estimate_intelligence.json")
const docsDir = resolve(SEEDS_DIR, "../documents/estimate_intelligence")
const assessmentPath = resolve(docsDir, "bathroom_leak_assessment.json")
const jobLibraryPath = resolve(docsDir, "past_job_library.json")

describe("estimate intelligence JSON inputs", () => {
  const ctx = loadProjectContext(seedPath)
  const assessmentMod = ctx.project.modules.find((m) => m.label === "Current Assessment") as PipelineModule
  const jobMod = ctx.project.modules.find((m) => m.label === "Past Job Library") as PipelineModule
  const assessmentModel = ctx.project.models.find((m) => m.id === "m_assessment")!
  const jobModel = ctx.project.models.find((m) => m.id === "m_past_job")!
  const assessmentJson = readFileSync(assessmentPath, "utf8")
  const jobJson = readFileSync(jobLibraryPath, "utf8")
  const structs = { models: ctx.project.models, typeAliases: ctx.project.typeAliases }
  const assessmentDoc = { id: "doc_as", name: "bathroom_leak_assessment.json", type: InputType.Json } as DocRef
  const jobDoc = { id: "doc_jobs", name: "past_job_library.json", type: InputType.Json } as DocRef

  it("materializes the assessment object as Assessment (not a list)", () => {
    const value = materializeInputDocument(assessmentJson, "doc_as", assessmentMod, ctx.project.models, {
      docName: "bathroom_leak_assessment.json",
    })
    expect(Array.isArray(value)).toBe(false)
    expect(value).toMatchObject({ builder_id: "bld-prime-north", peril: "escape of water" })
    expect(validateStepOutput(value, assessmentModel, ctx.project.models).ok).toBe(true)
  })

  it("accepts the bundled assessment against Assessment", () => {
    expect(validateInferenceDocContent(assessmentMod, assessmentDoc, assessmentJson, structs)).toBeUndefined()
  })

  it("materializes the job library as list[PastJob] with denormalized billed_lines", () => {
    const value = materializeInputDocument(jobJson, "doc_jobs", jobMod, ctx.project.models, {
      docName: "past_job_library.json",
    })
    expect(Array.isArray(value)).toBe(true)
    const jobs = value as { id: string; billed_lines: { work_item_id: string; unit_rate: number }[] }[]
    expect(jobs[0]?.id).toBe("job-bathroom-ceiling-collapse")
    expect(jobs[0]?.billed_lines?.[0]?.work_item_id).toBe("WI-00001")
    expect(jobs[0]?.billed_lines?.[0]?.unit_rate).toBeGreaterThan(0)
    expect(validateStepOutput(jobs, jobModel, ctx.project.models, { isList: true }).ok).toBe(true)
  })

  it("accepts the bundled job library against list[PastJob]", () => {
    expect(validateInferenceDocContent(jobMod, jobDoc, jobJson, structs)).toBeUndefined()
  })
})

describe("estimate intelligence explode step", () => {
  it("uniques billed_lines by work_item_id and keeps source_job_id", async () => {
    const ctx = loadProjectContext(seedPath)
    const explode = ctx.project.modules.find((m) => m.label === "Explode Analogue Lines")!
    const entries = customCodeEntriesForModule(explode)
    expect(entries.some((e) => e.language === CustomCodeLanguage.Python)).toBe(false)
    const jobs = [
      {
        id: "job-a",
        billed_lines: [
          { work_item_id: "WI-1", code: "A", trade: "plumbing", description: "iso", unit: "each", quantity: 1, unit_rate: 10 },
          { work_item_id: "WI-2", code: "B", trade: "drywall", description: "sheet", unit: "m2", quantity: 4, unit_rate: 20 },
        ],
      },
      {
        id: "job-b",
        billed_lines: [
          { work_item_id: "WI-1", code: "A", trade: "plumbing", description: "iso", unit: "each", quantity: 2, unit_rate: 11 },
        ],
      },
    ]
    const { output } = await runCustomCodeWithFallbacks(entries, jobs, {})
    expect(output).toEqual([
      { work_item_id: "WI-1", code: "A", trade: "plumbing", description: "iso", unit: "each", quantity: 1, unit_rate: 10, source_job_id: "job-a" },
      { work_item_id: "WI-2", code: "B", trade: "drywall", description: "sheet", unit: "m2", quantity: 4, unit_rate: 20, source_job_id: "job-a" },
    ])
  })
})

describe("estimate intelligence headless inference + tests", () => {
  it("runs every inference preset and testing fixture through the UI engine with seed LLM", async () => {
    const seed = loadSeedForParity(seedPath)
    const project = migrateProjectModules(seed.project)
    const cases = parityCasesForSeed({ ...seed, project })
    expect(cases.some((c) => c.name.startsWith("inference:"))).toBe(true)
    expect(cases.some((c) => c.name.startsWith("test:"))).toBe(true)

    await withSeedLlmEnv(async () => {
      for (const c of cases) {
        const traces = await runUiParityTrace(project, seed, c.inputs)
        const labels = traces.map((t) => t.label)
        expect(labels, c.name).toEqual(
          expect.arrayContaining([
            "Current Assessment",
            "Past Job Library",
            "Select Comparable Jobs",
            "Explode Analogue Lines",
            "Select Applicable Lines",
            "Assemble Estimate Request",
            "Compose Preliminary Estimate",
            "Estimate Output",
          ]),
        )
        const jobs = traces.find((t) => t.label === "Select Comparable Jobs")?.output
        expect(Array.isArray(jobs) && jobs.length, `${c.name}: kept analogue jobs`).toBeGreaterThan(0)
        const lines = traces.find((t) => t.label === "Explode Analogue Lines")?.output as
          | { work_item_id?: string; source_job_id?: string; billed_lines?: unknown }[]
          | undefined
        expect(Array.isArray(lines) && lines.length, `${c.name}: exploded lines`).toBeGreaterThan(0)
        expect(lines![0]?.source_job_id).toBeTruthy()
        expect(lines![0]?.billed_lines).toBeUndefined()
        const estimate = traces.find((t) => t.label === "Estimate Output")?.output as {
          line_items?: unknown[]
          comparable_job_ids?: unknown[]
        }
        expect(estimate?.line_items?.length, `${c.name}: estimate lines`).toBeGreaterThan(0)
        expect(estimate?.comparable_job_ids?.length, `${c.name}: comparable jobs`).toBeGreaterThan(0)
      }
    })
  }, 60_000)
})
