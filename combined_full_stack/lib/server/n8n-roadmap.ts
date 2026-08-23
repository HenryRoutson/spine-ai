// AI : n8n typed piece step — grep "TODO (n8n" for open work; mark DONE when a stage ships.
//
// Goal: typing on top of n8n + automatic UI. Catalog pieces run local n8n Code-node JS
// against Spine structures. Do NOT call live Slack/Gmail (user: no integration execution).
// Webhook stays the generic HTTP escape hatch. Share pieces as JSON (Activepieces-style).
// Live n8n Cloud execute / credential store remains out of scope.
//
// Shape:
//   ModuleKind.N8n = "n8n"
//   n8nNodeType: string
//   n8nParameters?: Record<string, unknown>
//   n8nCode?: string            // optional Code-node JS override
//   n8nTimeoutMs?: number
//
// Runtime: spine → [{ json }] → eval piece n8nCode → materializeStepOutput(outStructureId).
//
// AI : DONE (n8n-stage-A) — ModuleKind.N8n + fields + MODULE_META + factory defaults
// AI : DONE (n8n-stage-A-ui) — KIND_ICON/COLOR/SURFACE + USER_ADDABLE + n8n-fields.tsx auto form
// AI : DONE (n8n-stage-A-api) — api_schemas + seed schema + InvalidKind.MissingN8nNodeType
// AI : DONE (n8n-stage-B-catalog) — bundled action pieces in lib/n8n-catalog.ts (not live nodes-base dump)
// AI : DONE (n8n-stage-C-params) — PieceProp → builder form (string/number/boolean/json/select)
// AI : TODO (n8n-stage-D-creds) — live vendor credentials; skipped (no live integrations)
// AI : DONE (n8n-stage-E-exec) — steps/n8n.ts local Code-node JS (not N8N_API_KEY ephemeral workflow)
// AI : DONE (n8n-stage-F-spine) — in/out structures + computeN8nInvalid
// AI : DONE (n8n-stage-G-export) — STEP_BODY n8n + assistant-prompt / moduleSpecSchema
// AI : DONE (n8n-stage-H-community) — pieces/*.json + MCP list_pieces / import_piece / export_piece
// AI : DONE (media-view-D-higgsfield) — generate APIs are webhook poll + ingest, not an n8n node.

export {};
