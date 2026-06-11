# Combining `backend` + `V0 frontend prototypes/v2/ai-pipeline-builder` → `combined_full_stack`

## The core idea

The v2 frontend is a Next.js shell whose entire `lib/` layer is **missing from disk** —
every component imports `@/lib/store`, `@/lib/types`, `@/lib/run-engine`, `@/lib/pydantic`,
`@/lib/doc-viewer` but none exist. The backend was deliberately written to *be* that layer
(same type names: `Project`, `PipelineModule`, `PipelineRun`, `MODEL_OPTIONS`, `MODULE_META`,
`allModelsToPydantic`, ...). So "combining" = one Next.js app where:

- backend code runs **server-side only** (it uses `fs`, `vm`, `pdf-parse`, `dotenv` — none work in the browser)
- a thin client layer (React context + API routes) bridges the browser to it

```
combined_full_stack/
├── app/                  # copied from v2 (page.tsx, layout.tsx, globals.css)
│   └── api/              # NEW: route handlers bridging client → backend
├── components/           # copied from v2 unchanged (incl. components/ui)
├── lib/
│   ├── server/           # copied from backend/lib (Node-only: store, run_engine, llm, ...)
│   ├── types.ts          # shared, importable by both sides (types + MODEL_OPTIONS etc.)
│   ├── store.tsx         # NEW client context — fetches from /api instead of seeding mocks
│   ├── doc-viewer.tsx    # NEW small client context (overlay state)
│   ├── pydantic.ts       # re-export of server pydantic (pure, no Node deps — safe on client)
│   ├── run-engine.ts     # client shim: calls /api/runs, polls progress
│   └── utils.ts          # cn() helper (shadcn)
├── data/                 # backend/data (gitignored, JSON persistence)
├── seeds/                # backend/seeds
├── package.json          # merged deps (next/react/shadcn + zod/pdf-parse/dotenv)
└── next.config.mjs       # serverExternalPackages: ["pdf-parse"]
```

## Steps

### 1. Scaffold
- [ ] Copy v2 `app/`, `components/`, `components.json`, `postcss.config.mjs`, `tsconfig.json` into `combined_full_stack/`
- [ ] Copy `backend/lib/*` → `lib/server/` (exclude `*.test.ts`, `demo*.ts`, `vitest_reporter.ts`)
- [ ] Copy `backend/seeds/` and point `lib/server/config.ts` data dir at `combined_full_stack/data/`
- [ ] Merge `package.json`: v2 deps + `zod`, `pdf-parse`, `dotenv`; scripts `dev`/`build`/`start`
- [ ] `next.config.mjs`: keep `typescript.ignoreBuildErrors` off once lib exists; add `serverExternalPackages: ["pdf-parse"]`
- [ ] Root `.env` already has `OPENROUTER_API_KEY` + Supabase keys (`SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*`) — load via `dotenv` path or move to `combined_full_stack/.env.local`

### 2. Shared types (`lib/types.ts`)
- [ ] Re-export from `lib/server/types.ts` + `config.ts` registries (`MODEL_OPTIONS`, `DEFAULT_MODEL`, `MODULE_META`, `STRATEGY_META`, `FIELD_TYPES`, `INPUT_TYPES`)
- [ ] Verify these modules are pure (no `fs`/`process` at import time) so the client bundle can use them; split out anything that isn't

### 3. API routes (`app/api/`) — the bridge
Backend stays a library; routes are thin wrappers around `openStore()` + exports:
- [ ] `GET /api/state?projectId=` → `{ projects, project, models, modules, strategies, docs, runs, billing }` (use `billingSeries`/`billingFromRuns` for billing tab)
- [ ] `PUT /api/projects/:id` → persist `models` / `modules` / `strategies` edits (structure + pipeline builders call this on change)
- [ ] `POST /api/docs` → upload: `hashContent` + `pdfToText`, store in `data/docs/` (replaces pseudo-hash `addDoc`)
- [ ] `POST /api/runs` → `runPipeline(store, projectId, inputDocId, { model })`; return runId immediately, run async
- [ ] `GET /api/runs/:id/progress` → poll step status for the inference animation (or stream via SSE from `FileLog`/`progressHtml`)
- [ ] `GET /api/docs/:id/text` → real source text for doc-viewer (replaces hardcoded `LEGAL_SOURCE_TEXT`)
- [ ] `POST /api/abtest` → `runBenchmark(...)` + judge results (replaces setTimeout jitter in `ab-testing.tsx`)

### 4. Client store (`lib/store.tsx`)
- [ ] `StoreProvider`: fetch `/api/state` on mount + after mutations; expose the exact API components already use (`useStore`, `uid`, `addDoc`, `addRun`, `addProject`, `setModules`, `setModel`, ...)
- [ ] Mutations = optimistic local update + `PUT`/`POST` to API
- [ ] Keep `SEED_RULES`/`LEGAL_SOURCE_TEXT` exports temporarily; delete once doc-viewer + inference read real run output

### 5. De-mock components (small targeted edits)
- [ ] `inference.tsx`: replace `buildRun()` simulation with `POST /api/runs` + progress polling; render real `outputJson`/quotes instead of `SEED_RULES`; real doc ids instead of `"sha_doc"`
- [ ] `ab-testing.tsx`: wire Run → `/api/abtest`, display judged metrics
- [ ] `doc-viewer.tsx`: `sourceFor(docId)` → fetch `/api/docs/:id/text`; offsets from `quoteHref`/`parseQuoteHref`
- [ ] `documents.tsx`: real file upload → `/api/docs`
- [ ] `billing.tsx`: series keys + cache savings from `spendSplit`/`totalSaved` instead of hardcoded `"$3.41"`
- [ ] `pipeline-builder.tsx`: `avgMs`/`avgCostCents` from `moduleMetrics(runs)` instead of constants

### 6. Verify
- [ ] `npm run dev` → all 7 tabs render from seeded `data/store.json`
- [ ] Upload PDF → run inference end-to-end → quotes clickable in doc viewer
- [ ] A/B benchmark runs, billing reflects real ledger
- [ ] `tsc --noEmit` clean → remove `ignoreBuildErrors`

### 7. Users — Supabase auth + per-user data (DONE as prototype: `backend_with_users/`)
`SupabaseStore implements Store` + RLS isolation is **built and verified** (`npm run demo`
passes all checks against the live project — see `backend_with_users/README.md`). To adopt:
- [ ] Copy `supabase_store.ts` into `lib/server/`; copy the `@supabase/ssr` client helpers
      (browser / server / middleware) from the Supabase Next.js quickstart into `utils/supabase/`
- [ ] Sign-in/sign-up page using `supabase.auth.signInWithPassword` / `signUp` (browser client)
- [ ] API routes: build the user client from request session cookies → `openUserStore(client)`
      instead of `openStore()` — `runPipeline` etc. work unchanged; RLS scopes everything
- [ ] First sign-in seeding: upsert `defaultProject()` per user (what `JsonStore.init()` does)
- [ ] `schema.sql` already run in the Supabase SQL editor; `sb_secret_…` key stays server-only

### 8. Vercel deploy (do after local works)
Two things break on serverless; everything else (pdf-parse, zod, `vm` custom code, OpenRouter) just works:
- [ ] **Persistence**: Vercel fs is read-only (`/tmp` only, ephemeral) → `JsonStore` won't persist.
      Solved by step 7's `SupabaseStore`; run artifact files → Supabase Storage/blob instead of `data/runs/`.
- [ ] **Run execution**: returning `runId` then continuing in background gets frozen after the
      response → wrap pipeline execution in `waitUntil()` and set `maxDuration` on `/api/runs`
      (Fluid compute: ~300s Hobby / 800s Pro — enough for the legal pipeline, but it's the ceiling).
- [ ] Set `OPENROUTER_API_KEY` + Supabase keys in Vercel project env settings.

## Gotchas
- **Never import `lib/server/*` from a `"use client"` file** — `fs`/`vm` will break the bundle. Only `types.ts`/`pydantic.ts` (pure) cross the boundary.
- Backend writes `_latest` + timestamped artifact files per run — fine in dev, but `data/` must stay gitignored.
- `custom_code.ts` uses Node `vm` — server-only, but works in route handlers.
