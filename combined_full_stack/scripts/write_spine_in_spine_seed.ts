// AI : regenerate seeds/spine_in_spine.json + documents/spine_in_spine/* from the compiler source.
// AI : TODO (spine-in-spine-bootstrap-S1-schema) — models[] must match SPINE_PLATFORM_BLUEPRINT tables
// AI :   when S1 expands the product schema. Keep custom-code byte-equal to *CompileTs.
// AI : TODO (spine-in-spine-simple-S8-site) — also emit seeds/spine_in_spine_simple.json (4-page guest).
// AI : TODO (spine-in-spine-full-F7-seed) — also emit seeds/spine_in_spine_full.json (one page per AppWindowId).
// AI : TODO (spine-in-spine-dogfood-D0-spine) — loc meter reads those two seeds as spine-simple / spine-full.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  compileSchemaPack,
  compileSpineApp,
  SPINE_PLATFORM_BLUEPRINT,
  SPINE_SCHEMA_COMPILE_TS,
  SPINE_WEBSITE_COMPILE_TS,
} from "../lib/spine-in-spine"

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const seedPath = join(appRoot, "seeds", "spine_in_spine.json")
const docsDir = join(appRoot, "documents", "spine_in_spine")

function field(
  id: string,
  name: string,
  type: string,
  description: string,
  extra: Record<string, unknown> = {},
) {
  return { id, name, type, optional: false, description, ...extra }
}

const models = [
  {
    id: "m_field_def",
    name: "FieldDef",
    description: "One typed column on a table",
    fields: [
      field("f_field_name", "name", "text", "Column name"),
      field("f_field_type", "type_name", "text", "text | int | float | bool"),
      field("f_field_opt", "optional", "bool", "Nullable column"),
      field("f_field_desc", "description", "text", "What the column stores"),
    ],
  },
  {
    id: "m_table_def",
    name: "TableDef",
    description: "A database table compiled from a structure model",
    fields: [
      field("f_table_name", "name", "text", "Table name"),
      field("f_table_desc", "description", "text", "What a row means"),
      field("f_table_fields", "fields", "list[model]", "Columns", { ref: "m_field_def" }),
    ],
  },
  {
    id: "m_pipeline_def",
    name: "PipelineDef",
    description: "A typed pipeline a website can bind to",
    fields: [
      field("f_pipe_name", "name", "text", "Pipeline name"),
      field("f_pipe_in", "input_table", "text", "Structure that feeds this pipeline"),
      field("f_pipe_out", "output_table", "text", "Structure this pipeline emits"),
      field("f_pipe_steps", "steps", "list[text]", "Visible run steps"),
    ],
  },
  {
    id: "m_page_def",
    name: "PageDef",
    description: "A hosted HTML page with run and table slots",
    fields: [
      field("f_page_path", "path", "text", "Page path"),
      field("f_page_headline", "headline", "text", "Hero headline"),
      field("f_page_body", "body", "text", "Supporting copy"),
    ],
  },
  {
    id: "m_app_blueprint",
    name: "AppBlueprint",
    description: "Describe an app — tables, pipelines, pages — then compile it",
    fields: [
      field("f_app_name", "app_name", "text", "Product name"),
      field("f_app_tagline", "tagline", "text", "One-line pitch"),
      field("f_app_audience", "audience", "text", "Who it is for"),
      field("f_app_tables", "tables", "list[model]", "Database tables", { ref: "m_table_def" }),
      field("f_app_pipelines", "pipelines", "list[model]", "Typed pipelines", { ref: "m_pipeline_def" }),
      field("f_app_pages", "pages", "list[model]", "Hosted pages", { ref: "m_page_def" }),
    ],
  },
  {
    id: "m_schema_pack",
    name: "SchemaPack",
    description: "Compiled SQL plus the blueprint tables, pipelines, and pages",
    fields: [
      field("f_pack_name", "app_name", "text", "Product name"),
      field("f_pack_tagline", "tagline", "text", "One-line pitch"),
      field("f_pack_audience", "audience", "text", "Who it is for"),
      field("f_pack_sql", "sql_schema", "text", "CREATE TABLE statements"),
      field("f_pack_tables", "tables", "list[model]", "Database tables", { ref: "m_table_def" }),
      field("f_pack_pipelines", "pipelines", "list[model]", "Typed pipelines", { ref: "m_pipeline_def" }),
      field("f_pack_pages", "pages", "list[model]", "Hosted pages", { ref: "m_page_def" }),
    ],
  },
  {
    id: "m_port_wire",
    name: "TypedPortWire",
    description: "A type-checked connection from a table to a pipeline",
    fields: [
      field("f_wire_table", "table_name", "text", "Structure / table name"),
      field("f_wire_pipe", "pipeline_name", "text", "Pipeline name"),
      field("f_wire_status", "status", "text", "exact | unwired"),
    ],
  },
  {
    id: "m_spine_app",
    name: "SpineApp",
    description: "Compiled website HTML, upload form, schema, and share copy",
    fields: [
      field("f_out_name", "app_name", "text", "Product name"),
      field("f_out_tagline", "tagline", "text", "One-line pitch"),
      field("f_out_sql", "sql_schema", "text", "CREATE TABLE statements"),
      field("f_out_html", "website_html", "text", "Hosted HTML with {{run}} {{table}} {{pay}}"),
      field("f_out_upload", "upload_form_html", "text", "Auto-generated file inputs"),
      field("f_out_share", "share_copy", "text", "One-click share blurb"),
      field("f_out_ports", "typed_ports", "list[model]", "Typed table → pipeline wires", { ref: "m_port_wire" }),
    ],
  },
]

const seed = {
  id: "p_spine_in_spine",
  name: "Spine in Spine",
  kind: "spine-platform",
  models,
  modules: [
    {
      id: "mod_blueprint_in",
      kind: "input",
      label: "App blueprint",
      inputType: "json",
      inputNameContains: "blueprint",
      inputDescription: "JSON AppBlueprint — tables, pipelines, and pages to compile",
      outStructureId: "m_app_blueprint",
      cached: true,
      avgMs: 40,
      avgCostCents: 0,
      note: "Feed a typed app description. Compile steps stay LLM-free.",
      outType: { kind: "ref", modelId: "m_app_blueprint" },
    },
    {
      id: "mod_compile_schema",
      kind: "custom-code",
      label: "Compile schema",
      inputDescription: "AppBlueprint JSON — compile CREATE TABLE statements",
      inStructureId: "m_app_blueprint",
      outStructureId: "m_schema_pack",
      cached: true,
      avgMs: 8,
      avgCostCents: 0,
      note: "Must stay byte-equal to SPINE_SCHEMA_COMPILE_TS.",
      fallbackList: [{ typescript: SPINE_SCHEMA_COMPILE_TS }],
      inType: { kind: "ref", modelId: "m_app_blueprint" },
      outType: { kind: "ref", modelId: "m_schema_pack" },
    },
    {
      id: "mod_compile_website",
      kind: "custom-code",
      label: "Compile website",
      inputDescription: "SchemaPack — compile hosted HTML, upload form, and share copy",
      inStructureId: "m_schema_pack",
      outStructureId: "m_spine_app",
      cached: true,
      avgMs: 8,
      avgCostCents: 0,
      note: "Must stay byte-equal to SPINE_WEBSITE_COMPILE_TS.",
      fallbackList: [{ typescript: SPINE_WEBSITE_COMPILE_TS }],
      inType: { kind: "ref", modelId: "m_schema_pack" },
      outType: { kind: "ref", modelId: "m_spine_app" },
    },
    {
      id: "mod_spine_out",
      kind: "output",
      label: "Spine app",
      inputDescription: "Compiled SpineApp — schema, website, uploads, typed ports",
      inStructureId: "m_spine_app",
      outStructureId: "m_spine_app",
      cached: true,
      avgMs: 20,
      avgCostCents: 0,
      note: "The vibe-coded website plus the typed backend in one object.",
      inType: { kind: "ref", modelId: "m_spine_app" },
      outType: { kind: "ref", modelId: "m_spine_app" },
    },
  ],
  strategies: [
    {
      id: "s_spine_single",
      kind: "single-llm",
      name: "Single LLM Call",
      enabled: true,
      model: "deepseek-v4",
      accuracy: 90,
      latencyMs: 400,
      costCents: 0,
      passRate: 100,
    },
    {
      id: "s_spine_agent",
      kind: "claude-code",
      name: "Agent (Frontier)",
      enabled: true,
      model: "deepseek-v4",
      accuracy: 94,
      latencyMs: 800,
      costCents: 0,
      passRate: 100,
    },
    {
      id: "s_spine_cheap",
      kind: "cheap-agent",
      name: "Agent (Cheap Model)",
      enabled: true,
      model: "deepseek-v4",
      accuracy: 90,
      latencyMs: 600,
      costCents: 0,
      passRate: 100,
    },
  ],
  docs: [
    {
      name: "blueprint.json",
      type: "json",
      label: "inference",
      file: "spine_in_spine/blueprint.json",
    },
    {
      name: "spine_in_spine_inference.json",
      type: "json",
      label: "inference",
      file: "spine_in_spine/spine_in_spine_inference.json",
    },
    {
      name: "spine_in_spine_testing.json",
      type: "json",
      label: "training",
      file: "spine_in_spine/spine_in_spine_testing.json",
    },
  ],
  expectedOutputs: [
    { stepLabel: "Compile schema", file: "spine_in_spine/expected/compile_schema.json" },
    { stepLabel: "Compile website", file: "spine_in_spine/expected/compile_website.json" },
    { stepLabel: "Spine app", file: "spine_in_spine/expected/spine_app.json" },
  ],
  inferencePresets: [
    {
      name: "Compile Spine",
      description: "Compile the Spine platform blueprint into schema + hosted website.",
      inputs: { "App blueprint": "blueprint.json" },
      expectedOutputs: [
        { stepLabel: "Compile schema", file: "spine_in_spine/expected/compile_schema.json" },
        { stepLabel: "Compile website", file: "spine_in_spine/expected/compile_website.json" },
        { stepLabel: "Spine app", file: "spine_in_spine/expected/spine_app.json" },
      ],
    },
  ],
}

const pack = compileSchemaPack(SPINE_PLATFORM_BLUEPRINT)
const app = compileSpineApp(SPINE_PLATFORM_BLUEPRINT)

mkdirSync(join(docsDir, "expected"), { recursive: true })
writeFileSync(join(docsDir, "blueprint.json"), `${JSON.stringify(SPINE_PLATFORM_BLUEPRINT, null, 2)}\n`)
writeFileSync(
  join(docsDir, "spine_in_spine_inference.json"),
  `${JSON.stringify(
    {
      description: "Compile Spine described as an AppBlueprint — LLM-free custom-code.",
      inputs: { "App blueprint": "blueprint.json" },
    },
    null,
    2,
  )}\n`,
)
writeFileSync(
  join(docsDir, "spine_in_spine_testing.json"),
  `${JSON.stringify(
    {
      description: "Golden compile of the Spine-in-Spine blueprint.",
      inputs: { "App blueprint": "blueprint.json" },
      expectedOutputs: {
        "Compile schema": pack,
        "Compile website": app,
        "Spine app": app,
      },
    },
    null,
    2,
  )}\n`,
)
writeFileSync(join(docsDir, "expected", "compile_schema.json"), `${JSON.stringify(pack, null, 2)}\n`)
writeFileSync(join(docsDir, "expected", "compile_website.json"), `${JSON.stringify(app, null, 2)}\n`)
writeFileSync(join(docsDir, "expected", "spine_app.json"), `${JSON.stringify(app, null, 2)}\n`)
writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`)
console.log(`wrote ${seedPath}`)
console.log(`wrote ${docsDir}`)
