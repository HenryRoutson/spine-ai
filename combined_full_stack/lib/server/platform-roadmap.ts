// AI : Unified vibe coding platform — grep "TODO (platform" / "DONE (platform".
// Plan: docs/platform_plan.md
// Do NOT rebuild Vibe panel, ShareSiteForm, PipelineExportDialog, or SpineSession.
// Extend with typed ports, Supabase backend tab, auto-upload UI, and one-click share.

export {}

// ---------------------------------------------------------------------------
// P0 — Platform plan + roadmap
// ---------------------------------------------------------------------------
// AI : DONE (platform-P0-plan) — docs/platform_plan.md + this roadmap file

// ---------------------------------------------------------------------------
// P1 — Type-checked ports (mix & match structures ↔ pipelines)
// ---------------------------------------------------------------------------
// AI : DONE (platform-P1-ports-lib) — lib/platform-type-ports.ts
// AI : DONE (platform-P1-ports-ui) — components/platform/type-ports-panel.tsx
// AI : ports show pipeline input/output TypeExprs vs structure models
// AI : click compatible port → wires outStructureId on input module

// ---------------------------------------------------------------------------
// P2 — Supabase backend panel
// ---------------------------------------------------------------------------
// AI : DONE (platform-P2-schema) — components/platform/supabase-backend-panel.tsx
// AI : shows allModelsToSql schema, pipeline bindings, shared state keys
// AI : DONE (platform-P2-connect) — lib/supabase-site-provision.ts validates BYO URL/anon key + schema pack
// AI : TODO (platform-P2-provision) — allocate an isolated Supabase project (BYO keys work; Spine-hosted alloc does not)

// ---------------------------------------------------------------------------
// P3 — Auto-generated upload frontend
// ---------------------------------------------------------------------------
// AI : DONE (platform-P3-upload-ui) — lib/hosted-site-upload-ui.ts
// AI : DONE (platform-P3-export-wire) — hosted-site-export.ts injects upload form + step progress into run slots
// AI : generates file inputs from pipeline input modules (PDF, Excel, JSON, etc.)

// ---------------------------------------------------------------------------
// P4 — One-click platform share
// ---------------------------------------------------------------------------
// AI : DONE (platform-P4-share-hub) — components/platform/platform-share-hub.tsx
// AI : mint site + link + API from one panel; copy all URLs at once
// AI : DONE (platform-P4-share-wire) — SharePage simple + full Publish include the hub

// ---------------------------------------------------------------------------
// P5 — Backend tab (pipeline Vibe + website Building)
// ---------------------------------------------------------------------------
// AI : DONE (platform-P5-backend-tab) — AppWindowId.Backend + components/platform/backend-workspace.tsx
// AI : Schema / Ports / Tables / Run — feed a typed row into a compatible pipeline input

// ---------------------------------------------------------------------------
// P6 — Persist build surface preference
// ---------------------------------------------------------------------------
// AI : DONE (platform-P6-persist-surface) — lib/build-surface-persist.ts + AppShellProvider
// AI : remember Vibe vs Building across reloads

// ---------------------------------------------------------------------------
// P7 — Per-site Supabase (BYO, not allocated)
// ---------------------------------------------------------------------------
// AI : DONE (platform-P7-supabase-byo) — schema pack + URL/key validation on the Backend Connect tab
// AI : TODO (platform-P7-supabase-alloc) — allocate isolated Supabase project per hosted site

// ---------------------------------------------------------------------------
// P8 — Payment and table slots
// ---------------------------------------------------------------------------
// AI : DONE (platform-P8-pay-slot) — {{pay}} mounts HostedPaySlot on hosted pages
// AI : DONE (platform-P8-table-slot) — {{table:Model}} mounts live rows from the structure row store

// ---------------------------------------------------------------------------
// P9 — IDE/repo bridge (future)
// ---------------------------------------------------------------------------
// AI : TODO (platform-P9-sync) — POST /api/projects/:id/sync for repo ↔ hosted sync
// AI : TODO (platform-P9-embed) — embed routes for run output, compare, doc highlight

// ---------------------------------------------------------------------------
// P10 — Async Store (future)
// ---------------------------------------------------------------------------
// AI : TODO (platform-P10-async-store) — replace load-all/write-behind for serverless

// ---------------------------------------------------------------------------
// P11 — Spine in Spine (dogfood seed)
// ---------------------------------------------------------------------------
// AI : DONE (platform-P11-compiler) — lib/spine-in-spine.ts compiles an AppBlueprint → schema + website + share copy
// AI : DONE (platform-P11-seed) — seeds/spine_in_spine.json is Spine described as a typed app
