# Unified Vibe Coding Platform

Spine is a meta platform where non-technical users vibe-code websites, while technical users describe typed storage and functions — then mix and match them. Types are not a second schema: a Structure is both the pydantic model and the SQL table.

## What a development group is

A **project** is a group of **functions** (pipelines) that share one set of **structures** (types = SQL) and one **row store**. Websites bind to those functions many-to-many.

```
Project (shared types + storage)
├── Structures     type = CREATE TABLE. No pydantic↔SQL linking.
├── Functions[]    each function is a pipeline spine (the backend you build)
├── Rows           JSON in projects.data today; dedicated SQL tables later
└── Websites *──n  hosted pages bind any functions from any project
```

Do **not** add a Data tab that duplicates Structures. SQL preview and stored rows live on Structures. The Pipeline tab is where you build a function. Vibe runs a selected function.

## Surfaces (now)

| Surface | Role |
|---------|------|
| **Vibe** | Chat to build. Switch pipelines in the header; observe Inference / Schedule / Share / Logging. |
| **Structures** | Author shared types. Code preview (SQL / Python / TS). See which functions use a type. Edit stored rows. |
| **Pipeline** | Build the selected function (steps). This is the backend editor. |
| **Testing / Inference / Schedule** | Operate the selected function. Schedule records which function it fires. |
| **Page studio** | Hosted websites. Bind many functions. |
| **Share** | Mine / shared with me / marketplace — pipelines today; websites already; storage later. |

## Mix and match

- **Structures ↔ functions:** a structure is attached when a step’s `inStructureId` / `outStructureId` / type expr names it. Click the chip → open that step. No manual “wire pydantic to SQL”.
- **Functions ↔ websites:** `HostedSiteOptions.pipelineBindings` (already many projects per site).
- **Functions ↔ storage:** rows keyed by structure, shared by every function in the project.
- **Type drift across groups:** keep groups small. Unifying two projects’ types (diff, rename, merge) is later — grouping development is the way we avoid that.

## Storage plan

**Now:** persist rows on `Project.structureRows` (Postgres `projects.data` jsonb). Same SQL store as the pipeline. Hosted `{{table:Model}}` reads that blob.

**Next:** `public.structure_rows` with RLS, queryable per model, not bloating project JSON.

**Later:** isolated Supabase per hosted site; marketplace listings for a storage pack; live SQL instead of JSON maps at run time (`allModelsToSql` is still an annotation until the run engine reads tables).

## Share / marketplace (later)

Three catalogs with the same chrome (mine / shared with me / marketplace):

1. **Functions** — today’s pipeline share links + hosted APIs
2. **Websites** — hosted sites
3. **Storage** — a project’s structures + rows as a bindable backend

## Implementation phases

See `combined_full_stack/lib/server/platform-roadmap.ts`.

| Phase | Scope | Status |
|-------|-------|--------|
| P0–P4, P6, P8, P11 | Share hub, upload UI, slots, Spine-in-Spine compiler seed | Done |
| P5 | Data tab — **removed**. SQL + rows + function links live on Structures | This revision |
| P12 | Multiple functions per project + selector + Vibe inference picker | This revision |
| P13 | Rows on `projects.data` jsonb | This revision |
| P7 | Isolated Supabase alloc | Later |
| P9 | IDE/repo sync | Later |
| P10 | Async Store | Later |
| P14 | `structure_rows` table + RLS | Later |
| P15 | Share chrome for storage packs | Later |
| P16 | Unify/merge types across projects | Later |
| P17 | Spine-in-Spine **bootstrap** (guest UI on host engine) | `lib/server/spine-in-spine-bootstrap-roadmap.ts` — grep `TODO (spine-in-spine-bootstrap` |

## Principles

- **Extend, don't rebuild** — Vibe panel, ShareSiteForm, PipelineExportDialog, SpineSession
- **One type system** — StructureModel is the SQL table and the pydantic class
- **Pipeline tab = backend** — functions, not a separate schema studio
- **Project = group of functions** sharing types; website = mix of functions
- **Non-technical default** — Vibe first; Building editors behind developer tools
