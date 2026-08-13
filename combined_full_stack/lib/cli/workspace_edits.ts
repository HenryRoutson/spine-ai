// AI : workspace mutations shared by direct `spine session` commands and the Ink TUI.

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { FieldType, FIELD_TYPES, ModuleKind } from "@/lib/types"
import type { ModelId, PipelineModule, StructureModel, StructureModelId, TypeAlias, TypeAliasId } from "@/lib/types"
import type { SpineSession } from "@/lib/core/session"
import { uid } from "@/lib/id"
import { makeModule } from "@/lib/pipeline-module-factory"
import { USER_ADDABLE_MODULE_KINDS } from "@/lib/module-kinds"
import { loadProjectContext } from "@/lib/cli/project_context"
import { SEEDS_DIR, type SeedDocSpec } from "@/lib/server/seed"
import { allModelsToPydantic } from "@/lib/server/pydantic"
import { tryParseTypeExprString } from "@/lib/type-expr-parse"
import { isTestingFileName } from "@/lib/testing-files"
import { validateTestAgainstProject } from "@/lib/cli/validate_test"
import type { CliCommandResult, CliIssue } from "@/lib/cli/types"

export function addNamedModel(session: SpineSession, name: string): StructureModel {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("model name is empty")
  const model: StructureModel = {
    id: uid<StructureModelId>("m_"),
    name: trimmed,
    description: "",
    fields: [
      {
        id: uid("f_"),
        name: "summary",
        type: FieldType.Text,
        optional: false,
        description: "Short summary",
      },
    ],
  }
  const models = [...(session.project?.models ?? []), model]
  const modules = session.modules.map((m) =>
    m.kind === ModuleKind.Output ? { ...m, inStructureId: model.id, outStructureId: model.id } : m,
  )
  session.applyProjectChanges({ models, modules })
  return model
}

function readSeedDocSync(spec: SeedDocSpec): string {
  const txtSidecar = spec.path.replace(/\.pdf$/i, ".txt")
  if (existsSync(txtSidecar)) return readFileSync(txtSidecar, "utf8")
  return readFileSync(spec.path, "utf8")
}

export function resolveSeedPath(fileOrId: string): string {
  if (existsSync(fileOrId)) return fileOrId
  const named = fileOrId.endsWith(".json") ? fileOrId : `${fileOrId}.json`
  const inSeeds = join(SEEDS_DIR, named)
  if (existsSync(inSeeds)) return inSeeds
  throw new Error(`seed not found: ${fileOrId}`)
}

export function listSeedIds(): string[] {
  if (!existsSync(SEEDS_DIR)) return []
  return readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
}

export function importSeed(session: SpineSession, fileOrId: string) {
  const ctx = loadProjectContext(resolveSeedPath(fileOrId))
  const project = session.ingestProject(ctx.project, { open: true })
  for (const spec of ctx.seed.docSpecs) {
    try {
      const content = readSeedDocSync(spec)
      session.addDocContent({
        name: spec.name,
        type: spec.type,
        content,
        label: spec.label,
      })
    } catch {
      // AI : skip missing/binary seed docs — project still loads.
    }
  }
  return project
}

export function parseAddableKind(raw: string): ModuleKind | undefined {
  return USER_ADDABLE_MODULE_KINDS.find((k) => k === raw)
}

export function addPipelineStep(session: SpineSession, kind: ModuleKind, label?: string): PipelineModule[] {
  const models = session.models
  const globalModel = session.model as ModelId
  const modules = session.modules
  const outAt = modules.findIndex((m) => m.kind === ModuleKind.Output)
  const insertAt = outAt < 0 ? modules.length : outAt
  const fresh: PipelineModule[] =
    kind === ModuleKind.Combine
      ? [
          { ...makeModule(ModuleKind.Input, models, globalModel), label: "Document Input" },
          makeModule(ModuleKind.Combine, models, globalModel),
        ]
      : [makeModule(kind, models, globalModel)]
  if (label?.trim() && fresh.length === 1 && fresh[0]) {
    fresh[0] = { ...fresh[0], label: label.trim() }
  }
  session.setModules([...modules.slice(0, insertAt), ...fresh, ...modules.slice(insertAt)])
  return fresh
}

export function validateSessionTests(session: SpineSession): CliCommandResult {
  const project = session.project
  if (!project) {
    return {
      ok: false,
      command: "session tests",
      issues: [{ level: "error", where: "session", message: "no active project" }],
    }
  }
  const snap = session.getSnapshot()
  const tests = snap.docs.filter((d) => isTestingFileName(d.name))
  const allIssues: CliIssue[] = []
  const perFile: Record<string, { ok: boolean; errors: number; warnings: number }> = {}
  for (const doc of tests) {
    const content = snap.docContents[doc.id] ?? ""
    const result = validateTestAgainstProject(project, snap.docs, content, doc.name, (name) => {
      const match = snap.docs.find((d) => d.name === name)
      return match ? snap.docContents[match.id] : undefined
    })
    const errors = result.issues.filter((i) => i.level === "error").length
    const warnings = result.issues.filter((i) => i.level === "warning").length
    perFile[doc.name] = { ok: result.ok, errors, warnings }
    for (const issue of result.issues) {
      allIssues.push({ ...issue, where: `${doc.name} → ${issue.where}` })
    }
  }
  return {
    ok: !allIssues.some((i) => i.level === "error"),
    command: "session tests",
    issues: allIssues,
    data: {
      projectName: project.name,
      testCount: tests.length,
      perFile,
      summary: `${tests.length} test file(s)`,
    },
  }
}

function requireModel(session: SpineSession, name: string): StructureModel {
  const model = session.project?.models.find((m) => m.name === name || m.id === name)
  if (!model) throw new Error(`unknown model ${name}`)
  return model
}

export function parseFieldType(raw: string): FieldType | undefined {
  return FIELD_TYPES.find((t) => t === raw)
}

export function addModelField(
  session: SpineSession,
  modelName: string,
  fieldName: string,
  type: FieldType,
  opts?: { optional?: boolean; description?: string; deterministic?: boolean },
): void {
  const models = (session.project?.models ?? []).map((m) => {
    if (m.name !== modelName && m.id !== modelName) return m
    return {
      ...m,
      fields: [
        ...m.fields,
        {
          id: uid("f_"),
          name: fieldName,
          type,
          optional: opts?.optional ?? false,
          description: opts?.description ?? "",
          deterministic: opts?.deterministic,
        },
      ],
    }
  })
  session.applyProjectChanges({ models })
}

export function removeModelField(session: SpineSession, modelName: string, fieldName: string): void {
  requireModel(session, modelName)
  const models = (session.project?.models ?? []).map((m) => {
    if (m.name !== modelName && m.id !== modelName) return m
    return { ...m, fields: m.fields.filter((f) => f.name !== fieldName) }
  })
  session.applyProjectChanges({ models })
}

export function addTypeAlias(session: SpineSession, name: string, expr: string): TypeAlias {
  const parsed = tryParseTypeExprString(expr, session.models)
  if (!parsed.ok) throw new Error(parsed.error)
  const alias: TypeAlias = {
    id: uid<TypeAliasId>("ta_"),
    name,
    description: "",
    expr: parsed.expr,
  }
  session.setTypeAliases([...(session.project?.typeAliases ?? []), alias])
  return alias
}

export function patchStep(
  session: SpineSession,
  idOrLabel: string,
  patch: Partial<PipelineModule>,
): PipelineModule {
  const modules = session.modules.map((m) => (m.id === idOrLabel || m.label === idOrLabel ? { ...m, ...patch } : m))
  const found = modules.find((m) => m.id === idOrLabel || m.label === idOrLabel)
  if (!found) throw new Error(`unknown step ${idOrLabel}`)
  session.setModules(modules)
  return found
}

export function removeStep(session: SpineSession, idOrLabel: string): void {
  const next = session.modules.filter((m) => m.id !== idOrLabel && m.label !== idOrLabel)
  if (next.length === session.modules.length) throw new Error(`unknown step ${idOrLabel}`)
  session.setModules(next)
}

export function moveStep(session: SpineSession, idOrLabel: string, at: number): void {
  const modules = [...session.modules]
  const from = modules.findIndex((m) => m.id === idOrLabel || m.label === idOrLabel)
  if (from < 0) throw new Error(`unknown step ${idOrLabel}`)
  const [row] = modules.splice(from, 1)
  if (!row) return
  modules.splice(Math.max(0, Math.min(at, modules.length)), 0, row)
  session.setModules(modules)
}

export function exportSessionPydantic(session: SpineSession): string {
  return allModelsToPydantic(session.project?.models ?? [], session.project?.typeAliases ?? [])
}
