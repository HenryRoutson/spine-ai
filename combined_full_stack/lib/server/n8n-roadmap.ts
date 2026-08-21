// AI : n8n 1:1 node step — grep "TODO (n8n" for open work; mark DONE when a stage ships.
//
// Goal: one ModuleKind that maps 1:1 to a single n8n node type so the builder can offer
// every integration n8n ships (Slack, Gmail, HTTP, Sheets, …) without hand-writing each one.
// Webhook stays the generic HTTP escape hatch; N8n is the typed catalog + credential UX.
//
// Why OSS matters:
//   - n8n-nodes-base (+ @n8n/nodes-langchain) expose INodeTypeDescription (displayName,
//     properties, credentials, icons). Pin a release and vendor/generate a catalog JSON —
//     do NOT invent our own connector list.
//   - Credential field schemas exist via n8n Public API GET /credentials/schema/{type}
//     and in-repo credentials/*.credentials.ts — reuse, don't duplicate.
//   - Prefer executing against a self-hosted n8n instance (API key) over embedding
//     n8n-core in-process (huge runtime: credentials store, binary data, expression engine).
//
// Shape (proposed, not implemented):
//   ModuleKind.N8n = "n8n"
//   n8nNodeType: string          // e.g. "n8n-nodes-base.slack"
//   n8nNodeVersion?: number
//   n8nParameters?: Record<string, unknown>  // matches INodeProperties `name` keys
//   n8nCredentialEnv?: string    // env var → n8n credential id OR raw secret for simple APIs
//   n8nBaseUrlEnv?: string       // default N8N_BASE_URL
//   n8nApiKeyEnv?: string        // default N8N_API_KEY
//   n8nTimeoutMs?: number
//   n8nResponseMode?: "first" | "all" | "jsonPath"
//   n8nResponsePath?: string
//
// Runtime sketch:
//   1. Resolve catalog entry for n8nNodeType (reject triggers / webhook listeners — action nodes only).
//   2. Build ephemeral 1-node workflow: Manual Trigger → chosen node (parameters + credentials).
//   3. POST spine input as n8n items: [{ json: input }] (+ optional state if we add includeState).
//   4. Execute via n8n Public API (workflow run / execute) or a thin internal "run node" helper
//      we host next to n8n; map item.json[] → outStructureId via materializeStepOutput.
//
// Stages:
// AI : TODO (n8n-stage-A) — ModuleKind.N8n + PipelineModule fields + MODULE_META + factory defaults
// AI : TODO (n8n-stage-A-ui) — KIND_ICON/COLOR + USER_ADDABLE + pipeline-fields/n8n-fields.tsx picker shell
// AI : TODO (n8n-stage-A-api) — api_schemas allowlist + seed schema + InvalidKind for missing node type
// AI : TODO (n8n-stage-B-catalog) — generate/vendor nodes.json from pinned n8n-nodes-base; filter to action nodes
// AI : TODO (n8n-stage-C-params) — render INodeProperties → builder form (options, collections, displayOptions)
// AI : TODO (n8n-stage-D-creds) — credential type → env/secret mapping; optional GET /credentials/schema
// AI : TODO (n8n-stage-E-exec) — steps/n8n.ts + exec_module case: ephemeral workflow run against N8N_* env
// AI : TODO (n8n-stage-F-spine) — deriveIn/Out (likely json / outStructureId); validity + migrate
// AI : TODO (n8n-stage-G-export) — pipeline_export_shared + assistant-prompt / moduleSpecSchema
// AI : TODO (n8n-stage-H-community) — optional community node packages beyond nodes-base
// AI : DONE (media-view-D-higgsfield) — generate APIs are webhook poll + ingest (media-view-roadmap), not an n8n node.

export {};
