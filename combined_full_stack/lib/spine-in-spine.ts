// AI : Spine-in-Spine compiler — AppBlueprint JSON → SQL + hosted HTML + typed ports + share copy.
// Seed custom-code must stay byte-equal to the *CompileTs strings below.
// AI : TODO (spine-in-spine-bootstrap) — this file is the P11 dogfood compiler (toy 3 tables + 1 mega page).
// AI :   Rebuild the *product UI* as guest pages on the host engine — steps S1–S10 in
// AI :   lib/server/spine-in-spine-bootstrap-roadmap.ts. Grep TODO (spine-in-spine-bootstrap.
// AI : TODO (spine-in-spine-simple) — SPINE_PLATFORM_BLUEPRINT becomes the 4-page simple guest;
// AI :   seed seeds/spine_in_spine_simple.json. Do not overload P11's toy seed.
// AI : TODO (spine-in-spine-full) — add SPINE_PLATFORM_BLUEPRINT_FULL: one page per AppWindowId,
// AI :   {{slot:structure|pipeline|…}} + spine-full CSS. Seed spine_in_spine_full.json.
// AI :   Pixel goldens: lib/spine-in-spine-dogfood.ts SPINE_FULL_PIXEL_SCENES.

export type field_def = {
  name: string
  type_name: string
  optional: boolean
  description: string
}

export type table_def = {
  name: string
  description: string
  fields: field_def[]
}

export type pipeline_def = {
  name: string
  input_table: string
  output_table: string
  steps: string[]
}

export type page_def = {
  path: string
  headline: string
  body: string
  // AI : TODO (spine-in-spine-bootstrap-S2-pages) — add html?: string (or compile from headline/body +
  // AI :   a slot layout enum) so each page is a hosted HTML document, not a <section> concatenated
  // AI :   into one mega page. Paths: / | /structures | /functions | /account.
}

export type app_blueprint = {
  app_name: string
  tagline: string
  audience: string
  tables: table_def[]
  pipelines: pipeline_def[]
  pages: page_def[]
}

export type schema_pack = {
  app_name: string
  tagline: string
  audience: string
  sql_schema: string
  tables: table_def[]
  pipelines: pipeline_def[]
  pages: page_def[]
}

export type typed_port_wire = {
  table_name: string
  pipeline_name: string
  status: string
}

export type spine_app = {
  app_name: string
  tagline: string
  sql_schema: string
  website_html: string
  upload_form_html: string
  share_copy: string
  typed_ports: typed_port_wire[]
}

export const SPINE_SCHEMA_COMPILE_TS = `(input) => {
  const blueprint = input && typeof input === "object" ? input : {};
  const tables = Array.isArray(blueprint.tables) ? blueprint.tables : [];
  const pipelines = Array.isArray(blueprint.pipelines) ? blueprint.pipelines : [];
  const pages = Array.isArray(blueprint.pages) ? blueprint.pages : [];
  const sql = tables.map((table) => {
    const cols = (Array.isArray(table.fields) ? table.fields : []).map((field) => {
      const sqlType = field.type_name === "int" || field.type_name === "bool" ? "INTEGER"
        : field.type_name === "float" ? "REAL" : "TEXT";
      const nulls = field.optional ? "" : " NOT NULL";
      return "  " + String(field.name) + " " + sqlType + nulls;
    });
    const body = ["  id TEXT PRIMARY KEY"].concat(cols).join(",\\n");
    return "CREATE TABLE " + String(table.name || "table").toLowerCase() + " (\\n" + body + "\\n);";
  }).join("\\n\\n");
  return {
    app_name: String(blueprint.app_name || "Untitled app"),
    tagline: String(blueprint.tagline || ""),
    audience: String(blueprint.audience || ""),
    sql_schema: sql || "-- no tables",
    tables,
    pipelines,
    pages,
  };
}`

// AI : TODO (spine-in-spine-bootstrap-S7-compile) — emit per-page HTML (S2), plus {{auth}} {{chatbot}}
// AI :   {{docs}} {{run:active-user-project}} {{slot:pipeline-dag}} / {{slot:type-expr}}. Keep this
// AI :   string byte-equal to the seed custom-code; regen via scripts/write_spine_in_spine_seed.ts.
export const SPINE_WEBSITE_COMPILE_TS = `(pack) => {
  const schema = pack && typeof pack === "object" ? pack : {};
  const appName = String(schema.app_name || "Untitled app");
  const tagline = String(schema.tagline || "");
  const tables = Array.isArray(schema.tables) ? schema.tables : [];
  const pipelines = Array.isArray(schema.pipelines) ? schema.pipelines : [];
  const pages = Array.isArray(schema.pages) ? schema.pages : [];
  const firstTable = tables[0] && tables[0].name ? String(tables[0].name) : "";
  const tableSlot = firstTable ? "{{table:" + firstTable + "}}" : "";
  const pageHtml = pages.map((page) => {
    return "<section class=\\"hs-feature\\"><h2>" + String(page.headline || page.path || "Page")
      + "</h2><p>" + String(page.body || "") + "</p></section>";
  }).join("\\n");
  const website_html = [
    "<nav class=\\"hs-nav\\"><span class=\\"hs-nav-name\\">" + appName + "</span></nav>",
    "<header class=\\"hs-hero\\"><p class=\\"hs-kicker\\">Vibe coding platform</p>",
    "<h1 class=\\"hs-title\\">" + tagline + "</h1>",
    "<p class=\\"hs-lede\\">Typed pipelines, a hosted page, and a shared backend.</p></header>",
    pageHtml,
    "<section class=\\"hs-run\\" id=\\"run\\">{{run}}</section>",
    tableSlot ? "<section class=\\"hs-table\\" id=\\"data\\">" + tableSlot + "</section>" : "",
    "<section class=\\"hs-output\\" id=\\"output\\">{{output}}</section>",
    "<section class=\\"hs-pay\\" id=\\"pay\\">{{pay}}</section>",
  ].filter(Boolean).join("\\n");
  const upload_form_html = pipelines.map((pipe) => {
    return "<label>" + String(pipe.name) + " (" + String(pipe.input_table) + ")<input type=\\"file\\" /></label>";
  }).join("\\n") || "<p>No pipeline uploads</p>";
  const typed_ports = pipelines.map((pipe) => ({
    table_name: String(pipe.input_table || ""),
    pipeline_name: String(pipe.name || ""),
    status: pipe.input_table ? "exact" : "unwired",
  }));
  const share_copy = "Share " + appName + " — website + pipeline + API in one click.";
  return {
    app_name: appName,
    tagline,
    sql_schema: String(schema.sql_schema || ""),
    website_html,
    upload_form_html,
    share_copy,
    typed_ports,
  };
}`

function evalCompile<T>(source: string, input: unknown): T {
  // AI : seed custom-code is the same source — keep this eval-only for tests and CLI fixtures.
  const fn = new Function(`"use strict"; return (${source});`)() as (value: unknown) => T
  return fn(input)
}

export function compileSchemaPack(blueprint: app_blueprint): schema_pack {
  return evalCompile<schema_pack>(SPINE_SCHEMA_COMPILE_TS, blueprint)
}

export function compileWebsitePack(pack: schema_pack): spine_app {
  return evalCompile<spine_app>(SPINE_WEBSITE_COMPILE_TS, pack)
}

export function compileSpineApp(blueprint: app_blueprint): spine_app {
  return compileWebsitePack(compileSchemaPack(blueprint))
}

// AI : TODO (spine-in-spine-bootstrap-S1-schema) — replace these 3 marketing tables with the product
// AI :   schema (Project, StructureModel, ModelField, PipelineFunction, PipelineStep, Document,
// AI :   PipelineRun, SharedLink, WebsitePage). Fields a {{table}} can CRUD only — see roadmap S1.
// AI : TODO (spine-in-spine-bootstrap-S2-pages) — four builder pages (/, /structures, /functions,
// AI :   /account) instead of two feature blurbs. Slot layout is in the roadmap React→guest map.
export const SPINE_PLATFORM_BLUEPRINT: app_blueprint = {
  app_name: "Spine",
  tagline: "Vibe-code websites on typed pipelines",
  audience: "Non-technical builders and technical pipeline authors sharing one backend",
  tables: [
    {
      name: "Project",
      description: "A typed pipeline a website can bind to",
      fields: [
        { name: "name", type_name: "text", optional: false, description: "Pipeline name" },
        { name: "kind", type_name: "text", optional: false, description: "Task kind" },
      ],
    },
    {
      name: "StructureModel",
      description: "A database table / typed record",
      fields: [
        { name: "name", type_name: "text", optional: false, description: "Structure name" },
        { name: "description", type_name: "text", optional: false, description: "What the row means" },
      ],
    },
    {
      name: "WebsitePage",
      description: "A hosted HTML page with run and table slots",
      fields: [
        { name: "path", type_name: "text", optional: false, description: "Page path" },
        { name: "headline", type_name: "text", optional: false, description: "Hero headline" },
      ],
    },
  ],
  pipelines: [
    {
      name: "Compile app",
      input_table: "Project",
      output_table: "WebsitePage",
      steps: ["Read blueprint", "Compile schema", "Compile website", "Share"],
    },
    {
      name: "Run pipeline",
      input_table: "StructureModel",
      output_table: "WebsitePage",
      steps: ["Feed row", "Run steps", "Show output"],
    },
  ],
  pages: [
    {
      path: "index",
      headline: "Build the front end like Lovable",
      body: "Chat a page. Keep {{run}} where the workspace belongs. Share the site in one click.",
    },
    {
      path: "backend",
      headline: "Typed backends with state",
      body: "Describe tables and functions. Click a compatible type to feed a row into a pipeline.",
    },
  ],
}
