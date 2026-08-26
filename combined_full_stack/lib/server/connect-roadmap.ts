// AI : Hidden-app connectors for vibe coding — grep "TODO (connect" for open work.
//
// Product: n8n-style Slack/Gmail/Sheets from Vibe without a node canvas.
// Legal: do NOT host n8n, copy n8n-nodes-base, or store vendor OAuth in n8n we run.
// Engine: self-hosted Nango (or Activepieces CE later). Spine owns DAG + types + tests.
// UX: Connect {App} chip in Vibe. Only foreign page is Slack/Google OAuth popup.
//
// Shape:
//   ModuleKind.Connect = "connect"
//   connectActionId: connect_action_id_string   // catalog id, e.g. slack.postMessage
//   connectConnectionId?: nango_connection_id_string
//   connectParameters?: Record<string, unknown>
// Runtime: typed spine in → Nango proxy → materializeStepOutput(outStructureId).
// Testing: pin/mock connect output — never hit Slack from *_testing.json.
//
// AI : DONE (connect-A-kind) — ModuleKind.Connect + factory + USER_ADDABLE + seed/api zod + MODULE_META
// AI : DONE (connect-B-catalog) — short typed action list (Slack/Gmail/Sheets/HTTP); vibe must not invent ids
// AI : DONE (connect-C-validity) — MissingConnectAction / unknown id / missing params; connection required to Run not Approve
// AI : DONE (connect-D-exec) — steps/connect.ts + Nango client; testing source mocks; type gate on the way out
// AI : DONE (connect-E-nango) — nango/docker-compose.yml + setup_local.py nango; NANGO_SECRET_KEY + session API
// AI : DONE (connect-F-vibe) — Connect chip on Inference (simple); never mention nodes/spine; hide Pipeline
// AI : DONE (connect-G-oauth) — popup to vendor only (slack.com / accounts.google.com); same-origin Spine chrome
// AI : DONE (connect-H-assistant) — vibe proposes kind=connect from catalog; everyday language; Connect as chip after Approve
// AI : DONE (connect-I-mcp) — list_connect_actions + configure_connect_step; piece.* for local transforms
// AI : DONE (connect-J-export) — connect export = env-backed HTTP (NANGO_*), never bake tokens
// AI : DONE (connect-K-tests) — golden tests pin connect output; pinpoint first fail still works
// AI : DONE (connect-L-triggers) — inbound Share link + existing /api/schedules in Vibe Schedule tab
// AI : DONE (connect-M-hygiene) — user-facing n8n name gone; local Set/Filter as piece.set aliases
// AI : DONE (connect-N-reconnect) — expired token → in-Spine Reconnect chip, not nango.dev
//
// Do NOT: n8n Cloud sidecar, eval fetch(slack) in piece JS, Activepieces canvas, connect-link emails as default.

export {}
