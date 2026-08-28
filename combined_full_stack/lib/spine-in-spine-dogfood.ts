// AI : Spine-in-Spine dogfood — LoC + pixel types, and OSS React apps to recreate.
// Grep: TODO (spine-in-spine-dogfood
// Steps: lib/server/spine-in-spine-dogfood-roadmap.ts
// Tracks: simple (4-page) vs full (pixel-exact) in spine-in-spine-bootstrap-roadmap.ts

export type oss_license =
  | "MIT"
  | "Apache-2.0"
  | "BSD-3-Clause"
  | "AGPL-3.0"
  | "GPL-3.0"
  | "MPL-2.0"
  | "source-available"

export type dogfood_track = "simple" | "full" | "both" | "negative"

// AI : primitives the clone should bind — missing ones are the optimization backlog (new slots).
export type spine_primitive =
  | "table"
  | "form"
  | "kanban"
  | "chart"
  | "run"
  | "chatbot"
  | "docs"
  | "pay"
  | "auth"
  | "dag"
  | "code"

export type oss_clone_id = string & { __brand: "oss_clone_id" }

export type oss_clone_target = {
  id: oss_clone_id
  name: string
  github: string
  license: oss_license
  track: dogfood_track
  primitives: spine_primitive[]
  why: string
  loc_hypothesis: string
}

function clone(
  id: string,
  name: string,
  github: string,
  license: oss_license,
  track: dogfood_track,
  primitives: spine_primitive[],
  why: string,
  loc_hypothesis: string,
): oss_clone_target {
  return {
    id: id as oss_clone_id,
    name,
    github,
    license,
    track,
    primitives,
    why,
    loc_hypothesis,
  }
}

// AI : TODO (spine-in-spine-dogfood-D4-todomvc) — first clone; proves the LoC meter.
// AI : TODO (spine-in-spine-dogfood-D5-catalog-run) — after TodoMVC, pick the next `simple` row
// AI :   whose primitives are already slots (table/chatbot/docs). Promote a slot when ≥3 clones
// AI :   need the same custom HTML (form, kanban, chart).
export const SPINE_IN_SPINE_OSS_CLONES: oss_clone_target[] = [
  clone(
    "todomvc",
    "TodoMVC (React)",
    "https://github.com/tastejs/todomvc",
    "MIT",
    "simple",
    ["table"],
    "Baseline CRUD. {{table:Todo}} + add/toggle/clear actions. No pipeline.",
    "Guest should be tens of lines vs a few hundred React. If not, the meter is wrong.",
  ),
  clone(
    "ai-chatbot",
    "Vercel AI Chatbot",
    "https://github.com/vercel/ai-chatbot",
    "Apache-2.0",
    "simple",
    ["chatbot", "auth"],
    "Chat UI is {{chatbot}} + {{auth}}. Do not reimplement streaming in guest HTML.",
    "Most of the React app is chat chrome Spine already hosts.",
  ),
  clone(
    "umami",
    "Umami",
    "https://github.com/umami-software/umami",
    "MIT",
    "simple",
    ["table", "chart", "auth"],
    "Analytics = event table + a chart. Stress-tests a future {{chart}} slot.",
    "Tables win now; charts will bloat HTML until a slot exists — that's the optimize loop.",
  ),
  clone(
    "nocodb",
    "NocoDB (one base)",
    "https://github.com/nocodb/nocodb",
    "AGPL-3.0",
    "simple",
    ["table", "form", "auth"],
    "Spreadsheet/Airtable clone. Clone ONE table, not the whole product. {{table}} is the product.",
    "Should be the strongest LoC ratio. Full NocoDB is out of scope.",
  ),
  clone(
    "baserow",
    "Baserow (one table)",
    "https://github.com/bram2w/baserow",
    "MIT",
    "simple",
    ["table", "form"],
    "Same as NocoDB — another spreadsheet UI. Use to check the meter isn't NocoDB-specific.",
    "Simple track only. One table + row form.",
  ),
  clone(
    "react-admin",
    "React Admin demo",
    "https://github.com/marmelab/react-admin",
    "MIT",
    "simple",
    ["table", "form", "auth"],
    "Canonical admin CRUD. Guest pages = list + form per resource via {{table}} / {{form}}.",
    "If guest HTML per resource stays high, add {{form:Model}} (optimize D6).",
  ),
  clone(
    "refine-crm",
    "Refine CRM example",
    "https://github.com/refinedev/refine",
    "MIT",
    "simple",
    ["table", "kanban", "auth"],
    "CRM list + board. Kanban is the next slot after table/form.",
    "List-only simple clone first; kanban is the optimization, not v1 HTML.",
  ),
  clone(
    "twenty",
    "Twenty CRM",
    "https://github.com/twentyhq/twenty",
    "AGPL-3.0",
    "both",
    ["table", "form", "kanban", "auth"],
    "Modern Linear-ish CRM. Simple = contacts table. Full = pixel their list chrome.",
    "Full is hard (dense UI). Simple should still crush LoC.",
  ),
  clone(
    "plane",
    "Plane (Linear clone)",
    "https://github.com/makeplane/plane",
    "AGPL-3.0",
    "both",
    ["table", "kanban", "auth"],
    "Issues + cycles. Simple = issue table. Full needs {{kanban}} or it will lose LoC.",
    "Do not pixel-match the whole Plane app in v1. One board + one list.",
  ),
  clone(
    "langfuse",
    "Langfuse UI",
    "https://github.com/langfuse/langfuse",
    "MIT",
    "simple",
    ["table", "run", "docs"],
    "Traces ≈ PipelineRun table + step trace slot. Closest observability dogfood.",
    "Should reuse {{table:PipelineRun}} + {{slot:step-trace}} almost unchanged.",
  ),
  clone(
    "flowise",
    "Flowise",
    "https://github.com/FlowiseAI/Flowise",
    "Apache-2.0",
    "simple",
    ["dag", "run", "chatbot"],
    "LLM graph editor. Tests {{slot:pipeline-dag}}. Do not clone the node marketplace.",
    "DAG slot quality decides the ratio. Node palette stays host React.",
  ),
  clone(
    "langflow",
    "Langflow",
    "https://github.com/langflow-ai/langflow",
    "MIT",
    "simple",
    ["dag", "run"],
    "Second DAG clone so Flowise results aren't a one-off.",
    "Same slot as Flowise — if both need custom HTML, the DAG slot is too thin.",
  ),
  clone(
    "windmill",
    "Windmill (scripts + apps)",
    "https://github.com/windmill-labs/windmill",
    "AGPL-3.0",
    "both",
    ["run", "code", "table", "auth"],
    "Closest product. Simple = run a script + result table. Full = their app chrome.",
    "Full pixel is a stretch; still the best competitive LoC story.",
  ),
  clone(
    "n8n",
    "n8n editor",
    "https://github.com/n8n-io/n8n",
    "source-available",
    "simple",
    ["dag", "run"],
    "Workflow DAG. License is not OSI — clone UX, do not copy their source into the seed.",
    "Editor-only slice. Recreate with {{slot:pipeline-dag}} + {{run}}.",
  ),
  clone(
    "dify",
    "Dify studio",
    "https://github.com/langgenius/dify",
    "Apache-2.0",
    "simple",
    ["dag", "run", "chatbot", "docs"],
    "Studio + chat + knowledge. Maps to dag + chatbot + docs slots.",
    "Simple track: one workflow + one chat page, not the whole cloud console.",
  ),
  clone(
    "typebot",
    "Typebot",
    "https://github.com/baptisteArno/typebot.io",
    "AGPL-3.0",
    "simple",
    ["chatbot", "form", "run"],
    "Chatbot builder. Guest = {{chatbot}} + a form of bot steps as rows.",
    "Builder canvas may need DAG; the published bot is just chatbot+form.",
  ),
  clone(
    "calcom",
    "Cal.com",
    "https://github.com/calcom/cal.com",
    "AGPL-3.0",
    "simple",
    ["form", "table", "auth", "pay"],
    "Booking form + availability table + pay. Tests {{form}} and {{pay}}.",
    "Do not clone the whole marketplace. One event type + book page.",
  ),
  clone(
    "documenso",
    "Documenso",
    "https://github.com/documenso/documenso",
    "AGPL-3.0",
    "simple",
    ["docs", "form", "auth"],
    "Document signing. {{docs}} + a signature form. Natural docs-slot dogfood.",
    "PDF chrome stays the docs widget; guest is the envelope list + sign page.",
  ),
  clone(
    "drawdb",
    "DrawDB",
    "https://github.com/drawdb-io/drawdb",
    "AGPL-3.0",
    "simple",
    ["table", "dag"],
    "Schema designer. Structures tab IS this product. Simple = {{table:StructureModel}} + type-expr.",
    "If this is not a huge LoC win, Structures-as-SQL is not paying off.",
  ),
  clone(
    "hoppscotch",
    "Hoppscotch",
    "https://github.com/hoppscotch/hoppscotch",
    "MIT",
    "simple",
    ["form", "code", "table"],
    "API client. Request form + response viewer. Maps to form + code + output.",
    "Don't clone collections sync. One request runner page.",
  ),
  clone(
    "dub",
    "Dub.co",
    "https://github.com/dubinc/dub",
    "AGPL-3.0",
    "simple",
    ["table", "chart", "auth"],
    "Link shortener. Links table + click chart. Pitch-friendly LoC story.",
    "Simple list+create first. Charts wait on {{chart}}.",
  ),
  clone(
    "papermark",
    "Papermark",
    "https://github.com/mfts/papermark",
    "AGPL-3.0",
    "simple",
    ["docs", "table", "auth"],
    "Document sharing analytics. {{docs}} + view table.",
    "Subset: upload + link + views. Not the whole GTM suite.",
  ),
  clone(
    "openstatus",
    "OpenStatus",
    "https://github.com/openstatusHQ/openstatus",
    "AGPL-3.0",
    "simple",
    ["table", "chart", "auth"],
    "Status page + monitors table. Public page is hosted HTML — Spine's default.",
    "Public status page should be almost pure hosted HTML + {{table:Check}}.",
  ),
  clone(
    "chatwoot",
    "Chatwoot",
    "https://github.com/chatwoot/chatwoot",
    "MIT",
    "simple",
    ["chatbot", "docs", "table", "auth"],
    "Support inbox. {{chatbot}} + conversation table. Full pixel is a later maybe.",
    "One inbox + thread. Don't clone the whole helpdesk.",
  ),
  clone(
    "lobechat",
    "LobeChat",
    "https://github.com/lobehub/lobe-chat",
    "Apache-2.0",
    "simple",
    ["chatbot", "auth"],
    "ChatGPT-like UI. Should be almost only {{chatbot}} + {{auth}}.",
    "If guest LoC is high, {{chatbot}} is underpowered — fix the slot, not the clone.",
  ),
  clone(
    "librechat",
    "LibreChat",
    "https://github.com/danny-avila/LibreChat",
    "MIT",
    "simple",
    ["chatbot", "docs", "auth"],
    "Second chat clone (with file upload → {{docs}}).",
    "Same as LobeChat plus docs. Two chat clones keep the slot honest.",
  ),
  clone(
    "payload",
    "Payload CMS admin",
    "https://github.com/payloadcms/payload",
    "MIT",
    "simple",
    ["table", "form", "auth"],
    "Headless CMS admin = structures + rows. Guest is the admin, not the website.",
    "One collection. Website stays a hosted page bound to the collection table.",
  ),
  clone(
    "listmonk",
    "Listmonk",
    "https://github.com/knadh/listmonk",
    "AGPL-3.0",
    "simple",
    ["table", "form", "docs"],
    "Newsletter: subscribers table + campaign form + HTML body (docs/code).",
    "Don't clone the Go server. UI slice only.",
  ),
  clone(
    "appsmith",
    "Appsmith (one app)",
    "https://github.com/appsmithorg/appsmith",
    "Apache-2.0",
    "negative",
    ["table", "form", "code"],
    "Internal-tool builder — a meta product like Spine. Cloning the *builder* is circular.",
    "Skip as a full clone. Optional: rebuild one Appsmith *sample app* (not the IDE).",
  ),
  clone(
    "excalidraw",
    "Excalidraw",
    "https://github.com/excalidraw/excalidraw",
    "MIT",
    "negative",
    ["code"],
    "Canvas editor. Slots/tables are the wrong abstraction. Keep as a known miss.",
    "A high LoC guest here means someone cheated with a custom canvas slot. Don't.",
  ),
  clone(
    "tldraw",
    "tldraw",
    "https://github.com/tldraw/tldraw",
    "source-available",
    "negative",
    ["code"],
    "Same as Excalidraw — infinite canvas. License is not MIT; don't vendor.",
    "Use only to document 'Spine is not Figma'.",
  ),
  clone(
    "posthog",
    "PostHog (product analytics)",
    "https://github.com/posthog/posthog",
    "MIT",
    "negative",
    ["table", "chart"],
    "Too large. Clone a single insight view if anything, never the whole suite.",
    "Size is the lesson — pick Umami instead.",
  ),
  clone(
    "supabase-studio",
    "Supabase Studio",
    "https://github.com/supabase/supabase",
    "Apache-2.0",
    "negative",
    ["table", "code", "auth"],
    "Too large and it's our backend. Table editor ⊂ {{table}} but don't clone Studio.",
    "Dogfood Structures SQL preview instead.",
  ),
]

export const SPINE_IN_SPINE_OSS_CLONE_IDS: oss_clone_id[] = SPINE_IN_SPINE_OSS_CLONES.map((c) => c.id)

export type loc_bucket = "authored_guest" | "platform_slots" | "react_app" | "vendor_ui"

// AI : TODO (spine-in-spine-dogfood-D1-loc) — implement these counters in
// AI :   scripts/spine_in_spine_loc.ts. Do not count platform/vendor in the guest ratio.
export type loc_report = {
  clone_id: oss_clone_id | "spine-simple" | "spine-full"
  authored_guest: number
  platform_slots: number
  react_app: number
  vendor_ui: number
  ratio_guest_over_react: number
}

export type pixel_viewport = { width: number; height: number }

export const SPINE_FULL_PIXEL_VIEWPORTS: pixel_viewport[] = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]

export type pixel_scene = {
  id: string
  window: string
  seed: string
  viewports: pixel_viewport[]
  mask_selectors: string[]
}

// AI : TODO (spine-in-spine-full-F1-goldens) — one scene per AppWindowId; seed homework_grader.
export const SPINE_FULL_PIXEL_SCENES: pixel_scene[] = [
  "vibe",
  "structure",
  "pipeline",
  "testing",
  "inference",
  "documents",
  "share",
  "logging",
  "cache",
  "billing",
  "settings",
].map((window) => ({
  id: `homework_grader/${window}`,
  window,
  seed: "homework_grader",
  viewports: SPINE_FULL_PIXEL_VIEWPORTS,
  mask_selectors: ["time", "[data-dynamic]", "[data-run-id]", ".recharts-surface"],
}))
