# Unified Vibe Coding Platform

Spine is a meta platform where non-technical users vibe-code websites and apps, while technical users describe typed databases, pipelines, and APIs — then mix and match them with type-checked connections.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Vibe Coding Platform                        │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   Vibe Chat  │  Page Studio │  Data tab    │   One-Click Share  │
│  (agent)     │  (Lovable)   │  (tables)    │  (link/site/API)   │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│                    Typed Port Layer                              │
│  Structure models ↔ Pipeline inputs/outputs (type-checked)      │
├─────────────────────────────────────────────────────────────────┤
│                    SpineSession (shared core)                    │
│  Project + PipelineModule + TypeExpr + run_engine               │
├─────────────────────────────────────────────────────────────────┤
│                    Supabase (persistence)                        │
│  projects, docs, runs, shared_links, billing                    │
└─────────────────────────────────────────────────────────────────┘
```

## Surfaces

| Surface | User | What they do |
|---------|------|--------------|
| **Vibe** | Everyone | Chat to build — agent creates structures, pipelines, pages |
| **Page Studio** | Non-technical | Edit hosted HTML/React, brand, preview live |
| **Data tab** | Semi-technical | Edit tables and rows, connect them to pipeline steps, test a run |
| **Building** | Technical | Structure, Pipeline, Testing editors |
| **Share hub** | Everyone | One-click publish website + pipeline + API |

## Key concepts

### Typed ports

Every pipeline step has typed inputs and outputs (`TypeExpr`). Structure models are typed data shapes. The platform checks whether a structure can feed a pipeline input before you connect them — click a compatible port and it wires automatically.

### Auto-generated upload UI

Pipeline input modules (PDF, Excel, JSON, etc.) auto-generate file upload forms. These embed into hosted website run slots so the Lovable-style frontend has working upload UI without manual coding.

### Shared backend logic

Multiple frontends (websites) can bind to the same pipeline backend. Database schema (`schema.sql`) is derived from structure models and shared across all bound pipelines.

### One-click share

Publish everything at once: hosted website (`/site/{id}`), run link (`/run/{id}`), and hosted API — from a single hub.

## Implementation phases

See `combined_full_stack/lib/server/platform-roadmap.ts` for tracked TODOs.

| Phase | Scope | Status |
|-------|-------|--------|
| P0 | Platform plan + roadmap TODOs | Done |
| P1 | Type-checked ports library + UI | Done |
| P2 | Supabase backend panel (schema + state) | Done |
| P3 | Auto-generated upload frontend in exports | Done |
| P4 | Platform share hub (one-click) | Done |
| P5 | Data tab in website + pipeline workspace | Done |
| P6 | Persist build surface preference | Done |
| P7 | Per-site Supabase provisioning | BYO keys done; isolated alloc later |
| P8 | `{{pay}}` / `{{table:Model}}` slots | Done |
| P9 | IDE/repo bridge (CLI sync + embed routes) | Planned |
| P10 | Async Store for serverless | Planned |

## Principles

- **Extend, don't rebuild** — Vibe panel, ShareSiteForm, PipelineExportDialog, SpineSession
- **Website ≠ Project** — websites are `site_` shared links with pipeline bindings
- **Types are the contract** — `TypeExpr` IR is the single source of truth
- **Non-technical default** — Vibe surface first; Building editors behind developer tools toggle
