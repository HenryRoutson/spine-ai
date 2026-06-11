# backend_with_users

Supabase wrapper around `../backend`: **sign-in + user-specific data, no UI**.
Status: working — `npm run demo` passes all isolation checks against the live project.

## The idea

`SupabaseStore` implements the backend's existing `Store` interface (drop-in for
`JsonStore`), and **Postgres row-level security does all multi-tenancy**: each signed-in
user gets a Supabase client whose JWT scopes every query to their own rows. No `user_id`
appears anywhere in app code — sign-in *is* the data scoping.

## Files

| File | Role |
|------|------|
| `schema.sql` | `projects` / `docs` / `runs` tables (`data jsonb` mirrors backend types) + RLS policies — already run in the SQL editor |
| `lib/supabase_store.ts` | `SupabaseStore implements Store` — loads the user's rows in `init()`, sync reads from memory, write-behind upserts awaited by `flush()` |
| `lib/auth.ts` | `ensureUser` (admin API, demo-only), `signIn` → user-scoped client |
| `lib/config.ts` | fail-early env loading from repo root `.env` |
| `demo.ts` | the runnable proof: two users each write a project/doc/run, then fresh sessions verify isolation (incl. unfiltered SQL through the other user's client) |

## Run it

```bash
npm install
npm run demo
```

Env (repo root `.env`, already set): `SUPABASE_URL`, `SUPABASE_ANON_KEY`
(`sb_publishable_…`), `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_…`, bypasses RLS — server
only, never ship to a client).

Note: `ws` is passed as the realtime transport because Node 20 lacks native WebSocket;
drop it on Node ≥ 22.

## Adopting in `combined_full_stack`

- Frontend auth: `supabase.auth.signUp` / `signInWithPassword` via `@supabase/ssr`
  browser client (replaces demo-only `ensureUser`).
- API routes: build the user client from the request's session cookies (`@supabase/ssr`
  server client), then `openUserStore(client)` instead of `openStore()` — `runPipeline`
  etc. work unchanged.
- Per-user seeding: on first sign-in, upsert `defaultProject()` like `JsonStore.init()` does.
- This also solves the Vercel persistence problem (read-only fs) in the same move.
