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
- [x] Copy v2 `app/`, `components/`, `components.json`, `postcss.config.mjs`, `tsconfig.json` into `combined_full_stack/`
- [x] Copy `backend/lib/*` → `lib/server/` (exclude `*.test.ts`, `demo*.ts`, `vitest_reporter.ts`)
- [x] Copy `backend/seeds/` and point `lib/server/config.ts` data dir at `combined_full_stack/data/`
- [x] Merge `package.json`: v2 deps + `zod`, `pdf-parse`, `dotenv`; scripts `dev`/`build`/`start`
- [x] `next.config.mjs`: keep `typescript.ignoreBuildErrors` off once lib exists; add `serverExternalPackages: ["pdf-parse"]`
- [x] Root `.env` already has `OPENROUTER_API_KEY` + Supabase keys — `lib/server/config.ts` dotenv-loads `../.env`, and `.env.local` is a symlink to it so Next inlines the `NEXT_PUBLIC_*` values client-side

### 2. Shared types (`lib/types.ts`)
- [x] Re-export from `lib/server/types.ts` + `config.ts` registries (`MODEL_OPTIONS`, `DEFAULT_MODEL`, `MODULE_META`, `STRATEGY_META`, `FIELD_TYPES`, `INPUT_TYPES`)
- [x] Verify these modules are pure (no `fs`/`process` at import time) so the client bundle can use them; split out anything that isn't

### 3. API routes (`app/api/`) — the bridge
Backend stays a library; routes are thin wrappers around `openStore()` + exports:
- [x] `GET /api/state?projectId=` → `{ projects, docs, runs }` (client derives models/modules/strategies from the project and billing via `billingSeries(runs)`)
- [x] `PUT /api/projects/:id` → persist `models` / `modules` / `strategies` edits (structure + pipeline builders call this on change)
- [x] `POST /api/docs` → upload: `hashContent` + `pdfToText`, store in `data/docs/` (replaces pseudo-hash `addDoc`)
- [x] `POST /api/runs` → `runPipeline(store, projectId, inputDocId, { model })`; returns jobId immediately, runs async via `after()`
- [x] `GET /api/runs/:id/progress` → poll step status for the inference animation
- [x] `GET /api/docs/:id/text` → real source text for doc-viewer (replaces hardcoded `LEGAL_SOURCE_TEXT`)
- [x] `POST /api/abtest` → `runBenchmark(...)` + judge results (replaces setTimeout jitter in `ab-testing.tsx`)

### 4. Client store (`lib/store.tsx`)
- [x] `StoreProvider`: fetch `/api/state` on mount + after mutations; expose the exact API components already use (`useStore`, `uid`, `addDoc`, `addRun`, `addProject`, `setModules`, `setModel`, ...)
- [x] Mutations = optimistic local update + `PUT`/`POST` to API
- [x] Keep `SEED_RULES`/`LEGAL_SOURCE_TEXT` exports temporarily; delete once doc-viewer + inference read real run output (deleted)

### 5. De-mock components (small targeted edits)
- [x] `inference.tsx`: replace `buildRun()` simulation with `POST /api/runs` + progress polling; render real `outputJson`/quotes instead of `SEED_RULES`; real doc ids instead of `"sha_doc"`
- [x] `ab-testing.tsx`: wire Run → `/api/abtest`, display judged metrics
- [x] `doc-viewer.tsx`: `sourceFor(docId)` → fetch `/api/docs/:id/text`; offsets from `quoteHref`/`parseQuoteHref`
- [x] `documents.tsx`: real file upload → `/api/docs`
- [x] `billing.tsx`: series keys + cache savings from `spendSplit`/`totalSaved` instead of hardcoded `"$3.41"`
- [x] `pipeline-builder.tsx`: `avgMs`/`avgCostCents` from `moduleMetrics(runs)` instead of constants

### 6. Verify
- [x] `npm run dev` → all 7 tabs render from seeded `data/store.json`
- [x] Upload PDF → run inference end-to-end → quotes clickable in doc viewer (run artifacts under `data/runs/`)
- [x] A/B benchmark runs, billing reflects real ledger
- [x] `tsc --noEmit` clean (run artifacts in `data/` excluded from tsconfig) → `ignoreBuildErrors` removed; `next build` passes

### 7. Users — Supabase auth + per-user data (ADOPTED — verified end-to-end in the browser)
Anonymous requests keep the shared local `JsonStore`; a signed-in session makes every API
route open a per-user `SupabaseStore` (RLS isolation). `Store` gained `flush()` so routes
await write-behind persistence; `ensureSeeded()` is shared by both impls.
- [x] `lib/server/supabase_store.ts` (`SupabaseStore implements Store`); `@supabase/ssr` client
      helpers (browser / server / middleware) in `utils/supabase/` + root `middleware.ts`
- [x] Sign-in/sign-up page at `/login` using `supabase.auth.signInWithPassword` / `signUp`
      (browser client) + account menu in the header (email / sign out / sign-in link)
- [x] API routes: `getStore()` builds the user client from request session cookies →
      `openUserStore(client)` when signed in — `runPipeline` etc. work unchanged; RLS scopes everything
- [x] First sign-in seeding: `openUserStore` runs `ensureSeeded()` (same seeds/docs as `JsonStore.init()`)
- [x] `schema.sql` already run in the Supabase SQL editor; `sb_secret_…` key stays server-only

### 8. Vercel deploy (code is ready; the dashboard steps remain)
Two things break on serverless; everything else (pdf-parse, zod, `vm` custom code, OpenRouter) just works:
- [x] **Persistence**: solved by step 7's `SupabaseStore` for signed-in users (anonymous JsonStore
      falls back to ephemeral `/tmp/forge_data` on Vercel). Run artifact files (debug logs/HTML)
      still go to `/tmp` there — move to Supabase Storage only if they need to survive.
- [x] **Run execution**: pipeline runs inside Next's `after()` (the `waitUntil` equivalent) with
      `maxDuration = 300` on `/api/runs` and `/api/abtest`.
- [ ] Set `OPENROUTER_API_KEY` + `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
      in Vercel project env settings (manual dashboard step), then deploy.

## Gotchas
- **Never import `lib/server/*` from a `"use client"` file** — `fs`/`vm` will break the bundle. Only `types.ts`/`pydantic.ts` (pure) cross the boundary.
- Backend writes `_latest` + timestamped artifact files per run — fine in dev, but `data/` must stay gitignored.
- `custom_code.ts` uses Node `vm` — server-only, but works in route handlers.
