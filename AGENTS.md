# AGENTS.md

## Cursor Cloud specific instructions

### Repo layout (what actually runs)
- `combined_full_stack/` — **primary app**: Next.js 16 (App Router, Turbopack) + React 19 + Supabase + Tailwind v4. This is the product ("Spine"/"forge"): an LLM data-pipeline builder.
- `landing_page/` — standalone Next.js marketing site (no backend, no env vars).
- `automic_code/stripe/` — throwaway standalone Stripe demo script (not part of the product runtime).
- Each project manages its own deps with **npm** (own `package-lock.json`); there is no root workspace tool.

### Running the primary app (non-obvious — read before starting)
The app cannot be used through the UI without Supabase auth running:
- `combined_full_stack/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) gates every non-public page behind `/login`.
- `isProductionDeploy()` treats *any* Supabase env var being set as "production", which then requires the real DB schema (there is **no** local JSON-store fallback on the `/api/state` path). So you must run a real (local) Supabase with the schema present.

Startup (services must be started manually — never put these in the update script):
1. Ensure the Docker daemon is running (see "System deps" below), then from `combined_full_stack/`: `supabase start` (uses `supabase/config.toml`; API on `:54321`, DB `:54322`, Studio `:54323`). First start applies all migrations + `supabase/seed.sql`.
2. From `combined_full_stack/`: `npm run dev` (serves `http://localhost:3000`).
3. Sign up / sign in at `/login`. Local email confirmations are disabled (`config.toml` `enable_confirmations = false`), so signup yields an immediate session. A convenient test account: `dev@example.com` / `devpassword123` (recreate it after any `supabase db reset`, which wipes auth users).

### Required `combined_full_stack/.env.local` (gitignored — recreate it)
```
RATE_LIMIT_BACKEND=memory
OPENROUTER_API_KEY="sk-or-local-dev-placeholder"
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_ANON_KEY="<local anon JWT from `supabase status`>"
SUPABASE_SERVICE_ROLE_KEY="<local service_role JWT from `supabase status`>"
```
- `RATE_LIMIT_BACKEND=memory` avoids needing Upstash Redis.
- The OpenRouter `/models` pricing feed (hit by `/api/state` on **every** dashboard load) is public, so **any non-empty** `OPENROUTER_API_KEY` lets the app boot and lets you build/edit pipelines. Actual inference — running a pipeline, "Generate summary", the assistant — needs a **real billed key** or OpenRouter returns `401`.
- The `sb_publishable_...` / demo JWT keys above are the deterministic Supabase local defaults; re-copy them from `supabase status` if they ever change.

### Local DB schema (why two extra Supabase files exist)
The committed incremental migrations assume base tables (`projects`, `docs`, `runs`) that were created out-of-band on the hosted project, so a fresh local DB needs help:
- `supabase/migrations/20260627000000_base_schema.sql` creates `projects`/`docs`/`runs`/`run_jobs` (idempotent `if not exists`; a no-op against an env that already has them).
- `supabase/seed.sql` grants DML on all `public` tables to `anon`/`authenticated` (this local Postgres does **not** auto-grant DML on CLI-migration-created tables → otherwise every query is `permission denied`). Seed runs on `supabase db reset` / fresh `supabase start`, and is **not** applied by `supabase db push`.

### Lint / typecheck / test / build
- `combined_full_stack`: `npm run typecheck` (there is no `lint` and no test framework in this repo). `npm run build` for a production build.
- `landing_page`: `npm run lint` (note: it currently reports pre-existing `react-hooks/set-state-in-effect` errors — not caused by env setup) and `npm run build`.
- Config is cached at process start (`lib/server/config.ts` memoizes `getConfig()` and loads `.env.local` once), so **restart `npm run dev` after editing `.env.local`**.

### System deps (installed on the VM, not via the update script)
- Docker (needed for `supabase start`). In this nested-VM, dockerd needs the `fuse-overlayfs` storage driver, the `containerd-snapshotter` feature disabled (Docker 29+), and `iptables-legacy`; the daemon must be started manually (e.g. `sudo dockerd &`).
- Supabase CLI (`supabase`).
