// AI : Activepieces CE sidecar — grep "TODO (ap-sidecar" for open work; mark DONE when a stage ships.
//
// Product: wrap MIT AP pieces as typed Connect steps (auto UI + structureOut). n8n-Cloud-style vibe.
// Spine owns DAG + types + tests + share. AP is piece runtime + optional developer iframe later.
// Legal: CE image + community pieces (MIT). Do not copy packages/ee. Do not strip AP branding in an iframe.
//
// Lock (A0):
//   Project.modules[] is the only pipeline graph.
//   Do NOT git-submodule activepieces/activepieces.
//   Do NOT require() @activepieces/piece-* inside Next.
//   Do NOT sync AP canvas JSON ↔ Spine modules (that is a second DAG).
//   Do NOT dump the full piece catalog into the vibe prompt — allowlist only.
//   Do NOT iframe the AP editor until a typed Slack action passes golden tests (B1).
//
// Shape:
//   Same ModuleKind.Connect. AP ids are ap.{piece}.{action} e.g. ap.slack.send_channel_message.
//   connectConnectionId for AP = Activepieces connection externalId (not Nango).
// Runtime: typed spine in → AP sidecar HTTP (one action) → materializeStepOutput.
// Testing: mock apRunAction — never hit Slack from *_testing.json.
//
// AI : DONE (ap-sidecar-A0-lock) — this file; connect-roadmap points here
// AI : DONE (ap-sidecar-A1-docker) — activepieces/docker-compose.yml + setup_local.py ap
// AI : DONE (ap-sidecar-A2-catalog) — lib/ap-catalog.ts Slack/Gmail/Sheets allowlist → PieceProp
// AI : DONE (ap-sidecar-A3-exec) — ap_client.ts + execConnectStep engine=ap; tests mock
// AI : DONE (ap-sidecar-A4-vibe) — listConnectActions includes allowlist; assistant/MCP use getConnectAction
// AI : TODO (ap-sidecar-B1-iframe) — AppWindowId.Pieces, developer tools only, after A3 live Slack
// AI : TODO (ap-sidecar-B2-flow) — optional apFlowId on one Spine step (escape hatch, still one DAG)
// AI : TODO (ap-sidecar-C-grow) — more allowlist ids only when a seed/demo needs them
//
// Do NOT: n8n Cloud sidecar, AP canvas as source of truth, 600 ids in vibe, Nango+AP OAuth for the same token.

export {}
