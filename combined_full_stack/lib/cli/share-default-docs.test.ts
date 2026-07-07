import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { orderedInputModules } from "@/lib/inference-input"
import { collectInferenceInputIssues } from "@/lib/inference-validity"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import { SEEDS_DIR } from "@/lib/server/seed"
import type { DocId, ModuleId } from "@/lib/types"

describe("shareDefaultDocsByModule", () => {
  it("picks module-aware defaults for homework grader instead of reusing one inference file", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "homework_grader.json"))
    const inputModules = orderedInputModules(ctx.project.modules)
    const byModule = shareDefaultDocsByModule(ctx.project, ctx.docRefs, {})

    const schemaMod = inputModules.find((m) => m.label === "Marking Schema")
    const subsMod = inputModules.find((m) => m.label === "Student Submissions")
    expect(schemaMod).toBeTruthy()
    expect(subsMod).toBeTruthy()

    const schemaDoc = ctx.docRefs.find((d) => d.id === byModule[schemaMod!.id]?.[0])
    const subsDoc = ctx.docRefs.find((d) => d.id === byModule[subsMod!.id]?.[0])
    expect(schemaDoc?.name).toMatch(/marking_schema/i)
    expect(subsDoc?.name).toMatch(/homework_student/i)
    expect(schemaDoc?.id).not.toBe(subsDoc?.id)

    const assignment = Object.fromEntries(
      inputModules.flatMap((m) => {
        const ids = byModule[m.id]
        if (!ids?.length) return []
        const refs = ids.map((id) => ctx.docRefs.find((d) => d.id === id)!).filter(Boolean)
        return [[m.id, refs.length === 1 ? refs[0] : refs]]
      }),
    )
    const issues = collectInferenceInputIssues(inputModules, {}, {}, assignment)
    expect(issues).toEqual([])
  })

  it("keeps saved inference assignments and only defaults missing slots", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "homework_grader.json"))
    const inputModules = orderedInputModules(ctx.project.modules)
    const schemaMod = inputModules.find((m) => m.label === "Marking Schema")
    const subsMod = inputModules.find((m) => m.label === "Student Submissions")
    const schemaDoc = ctx.docRefs.find((d) => d.name === "homework_marking_schema_first_grade.json")
    expect(schemaMod).toBeTruthy()
    expect(subsMod).toBeTruthy()
    expect(schemaDoc).toBeTruthy()

    const byModule = shareDefaultDocsByModule(ctx.project, ctx.docRefs, {
      [schemaMod!.id]: schemaDoc!.id as DocId,
    })
    expect(byModule[schemaMod!.id]).toEqual([schemaDoc!.id])
    expect(byModule[subsMod!.id]?.[0]).toBeTruthy()
    expect(byModule[subsMod!.id]?.[0]).not.toBe(schemaDoc!.id)
  })
})
