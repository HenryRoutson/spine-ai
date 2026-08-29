import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { hashContent } from "@/lib/content-hash"
import { ephemeralPipelineStore } from "@/lib/server/landing_pipeline_run"
import { materializeProposal } from "@/lib/server/pipeline_assistant"
import { clearLlmProviderCache } from "@/lib/server/llm/registry"
import { runPipeline } from "@/lib/server/run_engine"
import { listAppSqlRows, resetAppSqlForTests } from "@/lib/server/app_sql"
import { appSqlScopeForProject } from "@/lib/app-sql"
import { formatPipelineValidationErrors } from "@/lib/server/validity"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import type { AssistantResponseRaw } from "@/lib/server/pipeline-authoring-schema"
import {
  DEFAULT_MODEL,
  DocLabel,
  InputType,
  RunStatus,
  type DocId,
  type ModuleId,
  type Project,
} from "@/lib/server/types"

const SOURCE = "Acme Corp billed 42 on Tuesday"

function quoteExtractRaw(): AssistantResponseRaw {
  return {
    message: "I'll extract a quoted span from each uploaded file.",
    modules: [
      {
        kind: "input",
        label: "Files",
        note: "Upload files.",
        structureOut: "list[Document]",
        inputType: "text",
        inputDescription: "files",
      },
      {
        kind: "llm-batch",
        label: "Extract",
        note: "One row per file. Field prompts come from the structure.",
        structureIn: "Document",
        structureOut: "QuoteRow",
        prompt: "",
        inputDescription: "files",
      },
      {
        kind: "output",
        label: "Rows",
        structureIn: "QuoteRow",
        structureOut: "QuoteRow",
        inputDescription: "rows",
      },
    ],
    modulePatch: null,
    models: [
      {
        name: "QuoteRow",
        description: "One quoted span.",
        fields: [
          {
            name: "excerpt",
            type: "tuple[text,quote]",
            optional: false,
            description: "Span copied from the file",
          },
        ],
      },
    ],
    typeAliases: null,
    docs: null,
    documentationUpdate: "# Quote extract\n",
    projectNameUpdate: "Quote Extract",
    targetFunctionName: null,
    proposedActions: null,
  }
}

function persistBatchPlaceholderRaw(): AssistantResponseRaw {
  const raw = persistBatchRaw()
  return {
    ...raw,
    modules: (raw.modules ?? []).map((m) =>
      m.kind === "sql"
        ? { ...m, sql: "INSERT INTO persist_row (vendor) VALUES (?, ?)" }
        : m,
    ),
  }
}

function persistBatchRaw(): AssistantResponseRaw {
  return {
    message: "I'll extract a vendor row per file and persist each with schema-derived SQL.",
    modules: [
      {
        kind: "input",
        label: "Files",
        note: "Upload files.",
        structureOut: "list[Document]",
        inputType: "text",
        inputDescription: "files",
      },
      {
        kind: "llm-batch",
        label: "Extract",
        note: "One row per file. Field prompts come from the structure.",
        structureIn: "Document",
        structureOut: "PersistRow",
        prompt: "",
        inputDescription: "files",
      },
      {
        kind: "sql",
        label: "Persist",
        note: "schema-derived insert",
        structureIn: "PersistRow",
        structureOut: "PersistRow",
        inputDescription: "rows",
      },
      {
        kind: "output",
        label: "Rows",
        structureIn: "PersistRow",
        structureOut: "PersistRow",
        inputDescription: "rows",
      },
    ],
    modulePatch: null,
    models: [
      {
        name: "PersistRow",
        description: "One persisted row.",
        fields: [{ name: "vendor", type: "text", optional: false, description: "Vendor copied from the file" }],
      },
    ],
    typeAliases: null,
    docs: null,
    documentationUpdate: "# Persist batch\n",
    projectNameUpdate: "Persist Batch",
    targetFunctionName: null,
    proposedActions: null,
  }
}

function persistRowRaw(): AssistantResponseRaw {
  return {
    message: "I'll extract a vendor row and persist it with schema-derived SQL.",
    modules: [
      {
        kind: "input",
        label: "Files",
        note: "Upload files.",
        structureOut: "Document",
        inputType: "text",
        inputDescription: "files",
      },
      {
        kind: "llm",
        label: "Extract",
        note: "One row. Field prompts come from the structure.",
        structureIn: "Document",
        structureOut: "PersistRow",
        prompt: "",
        inputDescription: "files",
      },
      {
        kind: "sql",
        label: "Persist",
        note: "schema-derived insert",
        structureIn: "PersistRow",
        structureOut: "PersistRow",
        inputDescription: "rows",
      },
      {
        kind: "output",
        label: "Rows",
        structureIn: "PersistRow",
        structureOut: "PersistRow",
        inputDescription: "rows",
      },
    ],
    modulePatch: null,
    models: [
      {
        name: "PersistRow",
        description: "One persisted row.",
        fields: [{ name: "vendor", type: "text", optional: false, description: "Vendor copied from the file" }],
      },
    ],
    typeAliases: null,
    docs: null,
    documentationUpdate: "# Persist\n",
    projectNameUpdate: "Persist",
    targetFunctionName: null,
    proposedActions: null,
  }
}

function projectFromRaw(raw: AssistantResponseRaw): Project {
  const session = createSpineSession()
  session.addProject({ open: true })
  const proposal = materializeProposal(raw, session.project!, DEFAULT_MODEL, [])
  if (!proposal) throw new Error("materializeProposal returned null")
  const errors = formatPipelineValidationErrors(proposal.modules, proposal.models, proposal.typeAliases)
  if (errors) throw new Error(errors)
  return {
    ...session.project!,
    name: proposal.projectName ?? session.project!.name,
    modules: proposal.modules,
    models: proposal.models,
    typeAliases: proposal.typeAliases,
    documentation: proposal.documentation,
  }
}

async function runWithSource(project: Project, source: string) {
  const id = hashContent(source)
  const store = ephemeralPipelineStore(project, [
    {
      ref: {
        id,
        name: "quote_sample.txt",
        type: InputType.Text,
        label: DocLabel.Inference,
        sizeKb: 1,
        uploadedAt: Date.now(),
        preview: source.slice(0, 180),
      },
      content: source,
    },
  ])
  const input = project.modules.find((m) => m.kind === "input")
  if (!input) throw new Error("no input module")
  return runPipeline(store, project.id, id, {
    model: DEFAULT_MODEL,
    inputDocsByModule: { [input.id]: [id] } as Partial<Record<ModuleId, DocId[]>>,
    persist: false,
    liveHtml: false,
    projectOverride: project,
    cacheOwnerId: `schema-driven:${project.id}`,
  })
}

describe("schema-driven quoting and SQL", () => {
  const prevProvider = process.env.LLM_PROVIDER

  beforeAll(() => {
    process.env.LLM_PROVIDER = "seed"
    clearLlmProviderCache()
  })

  afterAll(() => {
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER
    else process.env.LLM_PROVIDER = prevProvider
    clearLlmProviderCache()
  })

  beforeEach(() => {
    resetAppSqlForTests()
  })

  it("links tuple[text,quote] spans from a hosted-style upload under seed LLM", async () => {
    const project = projectFromRaw(quoteExtractRaw())
    expect(flattenPipelineModules(project.modules).some((m) => m.kind === "quote")).toBe(true)
    const llm = flattenPipelineModules(project.modules).find((m) => m.kind === "llm-batch")
    expect(llm?.prompt?.trim() ?? "").toBe("")

    const run = await runWithSource(project, SOURCE)
    expect(run.status).toBe(RunStatus.Ok)
    const quoteStep = run.steps.find((s) => s.kind === "quote")
    expect(quoteStep?.status).toBe("ok")
    const parsed = JSON.parse(quoteStep?.outputJson ?? "null") as Array<{
      excerpt: { text: string; quote: { doc_id: string; start: number; end: number } }
    }>
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.excerpt.text).toContain("Acme Corp")
    expect(parsed[0]!.excerpt.quote.doc_id).toMatch(/^sha_/)
    expect(parsed[0]!.excerpt.quote.end).toBeGreaterThan(parsed[0]!.excerpt.quote.start)
    const docId = parsed[0]!.excerpt.quote.doc_id
    expect(SOURCE.slice(parsed[0]!.excerpt.quote.start, parsed[0]!.excerpt.quote.end)).toContain("Acme")
    expect(docId).toBe(hashContent(SOURCE))
  })

  it("INSERTs extracted rows when sql is empty after an extract of the same structure", async () => {
    const project = projectFromRaw(persistRowRaw())
    const sqlMod = flattenPipelineModules(project.modules).find((m) => m.kind === "sql")
    expect(sqlMod?.sql?.trim() ?? "").toBe("")

    const run = await runWithSource(project, SOURCE)
    expect(run.status).toBe(RunStatus.Ok)
    const sqlStep = run.steps.find((s) => s.kind === "sql")
    expect(sqlStep?.inputPreview).toMatch(/^INSERT INTO persist_row /)
    expect(sqlStep?.inputPreview).toContain("Acme Corp billed 42 on Tuesday")

    const rows = await listAppSqlRows(appSqlScopeForProject(project.id), "persist_row")
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!.vendor)).toContain("Acme Corp")
  })

  it("INSERTs each llm-batch row when empty sql follows a list extract", async () => {
    const project = projectFromRaw(persistBatchRaw())
    const sqlMod = flattenPipelineModules(project.modules).find((m) => m.kind === "sql")
    expect(sqlMod?.sql?.trim() ?? "").toBe("")
    expect(sqlMod?.outType?.kind).toBe("list")
    expect(sqlMod?.inType?.kind).toBe("list")

    const run = await runWithSource(project, SOURCE)
    expect(run.status).toBe(RunStatus.Ok)
    const sqlStep = run.steps.find((s) => s.kind === "sql")
    expect(sqlStep?.inputPreview).toMatch(/^INSERT INTO persist_row /)
    const parsed = JSON.parse(sqlStep?.outputJson ?? "null") as unknown[]
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(1)

    const rows = await listAppSqlRows(appSqlScopeForProject(project.id), "persist_row")
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!.vendor)).toContain("Acme Corp")
  })

  it("omits placeholder INSERT after extract and INSERTs each row from the structure", async () => {
    const project = projectFromRaw(persistBatchPlaceholderRaw())
    const sqlMod = flattenPipelineModules(project.modules).find((m) => m.kind === "sql")
    expect(sqlMod?.sql?.trim() ?? "").toBe("")
    expect(sqlMod?.outType?.kind).toBe("list")

    const run = await runWithSource(project, SOURCE)
    expect(run.status).toBe(RunStatus.Ok)
    const sqlStep = run.steps.find((s) => s.kind === "sql")
    expect(sqlStep?.inputPreview).toMatch(/^INSERT INTO persist_row /)
    expect(sqlStep?.inputPreview).not.toContain("?")
    expect(sqlStep?.inputPreview).toContain("Acme Corp billed 42 on Tuesday")

    const rows = await listAppSqlRows(appSqlScopeForProject(project.id), "persist_row")
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!.vendor)).toContain("Acme Corp")
  })

  it("derives INSERT at run time when a saved sql step still has placeholder binds", async () => {
    const project = projectFromRaw(persistBatchRaw())
    const sqlMod = flattenPipelineModules(project.modules).find((m) => m.kind === "sql")
    expect(sqlMod).toBeTruthy()
    sqlMod!.sql = "INSERT INTO persist_row (vendor) VALUES (?, ?)"

    const run = await runWithSource(project, SOURCE)
    expect(run.status).toBe(RunStatus.Ok)
    const sqlStep = run.steps.find((s) => s.kind === "sql")
    expect(sqlStep?.inputPreview).toMatch(/^INSERT INTO persist_row /)
    expect(sqlStep?.inputPreview).not.toContain("?")

    const rows = await listAppSqlRows(appSqlScopeForProject(project.id), "persist_row")
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!.vendor)).toContain("Acme Corp")
  })
})
