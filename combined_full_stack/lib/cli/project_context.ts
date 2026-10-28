// AI : load a seed JSON plus doc refs — same inputs validateTestFile expects in the UI.

import { readFileSync } from "node:fs"
import { isTestingFileName } from "@/lib/testing-files"
import { loadProjectSeed, type ProjectSeed } from "@/lib/server/seed"
import { DocLabel } from "@/lib/types"
import type { DocId, DocRef, Project } from "@/lib/types"

export type ProjectContext = {
  seedPath: string
  seed: ProjectSeed
  project: Project
  docRefs: DocRef[]
}

export function docRefsFromSeed(seed: ProjectSeed): DocRef[] {
  return seed.docSpecs.map((d) => ({
    id: d.name as DocId,
    name: d.name,
    type: d.type,
    label: d.label,
    sizeKb: 0,
    uploadedAt: 0,
    preview: "",
  }))
}

export function loadProjectContext(seedPath: string): ProjectContext {
  const seed = loadProjectSeed(seedPath)
  return {
    seedPath,
    seed,
    project: seed.project,
    docRefs: docRefsFromSeed(seed),
  }
}

export type SeedTestDoc = {
  name: string
  path: string
}

export function testingDocsInSeed(ctx: ProjectContext): SeedTestDoc[] {
  return ctx.seed.docSpecs
    .filter((d) => isTestingFileName(d.name))
    .map((d) => ({ name: d.name, path: d.path }))
}

export function inferenceDocsInSeed(ctx: ProjectContext): DocRef[] {
  return ctx.docRefs.filter((d) => d.label === DocLabel.Inference && !isTestingFileName(d.name))
}

export function readTextFile(path: string): string {
  return readFileSync(path, "utf8")
}
