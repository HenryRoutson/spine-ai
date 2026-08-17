import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateInferenceDocContent } from "@/lib/inference-validity"
import { SEEDS_DIR } from "@/lib/server/seed"
import {
  materializeInputDocument,
  pushMaterializedInput,
  stepOutputTypeName,
  validateStepOutput,
} from "@/lib/server/structure"
import { InputType, type DocRef, type PipelineModule } from "@/lib/types"

const billedSeed = resolve(SEEDS_DIR, "billed_work_catalog_select.json")
const jobLibraryPath = resolve(SEEDS_DIR, "../documents/billed_work_catalog_select/job_example_library.json")

describe("JSON list input spine", () => {
  const ctx = loadProjectContext(billedSeed)
  const jobMod = ctx.project.modules.find((m) => m.label === "Job Example Library") as PipelineModule
  const jobModel = ctx.project.models.find((m) => m.id === "m_job_ex")!
  const json = readFileSync(jobLibraryPath, "utf8")
  const structs = { models: ctx.project.models, typeAliases: ctx.project.typeAliases }
  const doc = { id: "doc_jobs", name: "job_example_library.json", type: InputType.Json } as DocRef

  it("materializes a JSON array file as a flat list[JobExample]", () => {
    const value = materializeInputDocument(json, "doc_jobs", jobMod, ctx.project.models, {
      docName: "job_example_library.json",
    })
    expect(Array.isArray(value)).toBe(true)
    expect((value as unknown[]).length).toBeGreaterThan(1)
    expect((value as { id: string }[])[0]?.id).toBe("job-bathroom-ceiling-collapse")

    const items: unknown[] = []
    pushMaterializedInput(items, value, true)
    const nestedWrap: unknown[] = []
    nestedWrap.push(value)
    expect(Array.isArray(nestedWrap[0])).toBe(true)
    const flattened: unknown[] = []
    pushMaterializedInput(flattened, nestedWrap[0], true)
    expect(flattened[0]).toMatchObject({ id: "job-bathroom-ceiling-collapse" })
    expect(validateStepOutput(flattened, jobModel, ctx.project.models, { isList: true }).ok).toBe(true)
  })

  it("rejects a wrapper object against list[JobExample] before run", () => {
    const issue = validateInferenceDocContent(
      jobMod,
      doc,
      JSON.stringify({ jobs: JSON.parse(json) }),
      structs,
    )
    expect(issue?.message).toMatch(/expected list\[JobExample\]/)
  })

  it("accepts the bundled job library array against list[JobExample]", () => {
    const issue = validateInferenceDocContent(jobMod, doc, json, structs)
    expect(issue).toBeUndefined()
  })

  it("names list validation as list[T]", () => {
    expect(stepOutputTypeName("JobExample", true)).toBe("list[JobExample]")
    expect(stepOutputTypeName("JobExample", false)).toBe("JobExample")
  })
})
