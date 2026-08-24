// AI : n8n typed piece step — grep "TODO (n8n" for open work; mark DONE when a stage ships.
//
// Goal: typing on top of n8n + automatic UI. Catalog pieces run local n8n Code-node JS
// against Spine structures. Do NOT call live Slack/Gmail from local pieces.
// Webhook stays the generic HTTP escape hatch. Share pieces as JSON (Activepieces-style).
//
// Shape (local pieces):
//   ModuleKind.N8n = "n8n"
//   n8nNodeType: string
//   n8nParameters?: Record<string, unknown>
//   n8nCode?: string            // optional Code-node JS override
//   n8nTimeoutMs?: number
//
// Runtime (local): spine → [{ json }] → eval piece n8nCode → materializeStepOutput(outStructureId).
//
// AI : DONE (n8n-stage-A) — ModuleKind.N8n + fields + MODULE_META + factory defaults
// AI : DONE (n8n-stage-A-ui) — KIND_ICON/COLOR/SURFACE + USER_ADDABLE + n8n-fields.tsx auto form
// AI : DONE (n8n-stage-A-api) — api_schemas + seed schema + InvalidKind.MissingN8nNodeType
// AI : DONE (n8n-stage-B-catalog) — bundled action pieces in lib/n8n-catalog.ts (not live nodes-base dump)
// AI : DONE (n8n-stage-C-params) — PieceProp → builder form (string/number/boolean/json/select)
// AI : DONE (n8n-stage-D-creds) — SKIPPED for local pieces (no vendor OAuth in-process). Sidecar uses S-* below.
// AI : DONE (n8n-stage-E-exec) — steps/n8n.ts local Code-node JS (not N8N_API_KEY ephemeral workflow)
// AI : DONE (n8n-stage-F-spine) — in/out structures + computeN8nInvalid
// AI : DONE (n8n-stage-G-export) — STEP_BODY n8n + assistant-prompt / moduleSpecSchema
// AI : DONE (n8n-stage-G-export-run) — TS export bakes catalog JS + runN8nCode (UI parity); py/go/rs raise
// AI : DONE (n8n-stage-H-community) — pieces/*.json + MCP list_pieces / import_piece / export_piece
// AI : DONE (media-view-D-higgsfield) — generate APIs are webhook poll + ingest, not an n8n node.
//
// --- Sidecar (Path A): Spine owns typed I/O; n8n Cloud/self-host owns Slack/Gmail/Sheets ---
// Do NOT grow local n8nCode into app connectors. Live apps stay in n8n; Spine invokes a workflow.
//
// AI : TODO (n8n-sidecar-S1-creds) — N8N_BASE_URL + N8N_API_KEY in user_secrets (never in export zip).
// AI :   OAuth for Slack/Gmail stays in n8n; Spine only stores the n8n invoke credential.
// AI : TODO (n8n-sidecar-S2-live) — branch execN8nStep: local catalog vs live execute (webhook URL or Public API).
// AI :   Wire unused n8nResponseMode / n8nResponsePath; timeouts/retries like webhook poll, not evalN8nCode.
// AI : TODO (n8n-sidecar-S3-adapter) — spine ↔ n8n items for live payloads; materializeStepOutput is the type gate.
// AI :   Do not let untyped JSON leak into downstream LLM steps.
// AI : TODO (n8n-sidecar-S4-ui) — n8n-fields: mode local|live; live = workflow id / webhook path + response map.
// AI :   Do not dump 400 n8n Cloud nodes into n8n-catalog.ts.
// AI : TODO (n8n-sidecar-S5-http) — share URL/auth/timeout helpers with webhook-step; do NOT merge ModuleKind.
// AI : TODO (n8n-sidecar-S6-assistant) — assistant-prompt: when live, pick workflow + out structure; never invent node types.
// AI : TODO (n8n-sidecar-S7-export) — export live n8n as env-backed HTTP call (same family as webhook), not baked Code-node JS.

export {};
