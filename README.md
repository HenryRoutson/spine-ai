# antler_vc_hackathon

## Local hosting (Supabase + all apps)

Automated setup — see [`docs/local_deployment.md`](docs/local_deployment.md).

```bash
export OPENROUTER_API_KEY="sk-or-..."
python3 scripts/setup_local.py all
python3 scripts/setup_local.py dev
```

## Launch all (app + landing + dashboard)

```bash
npm install
npm run dev:all
```

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Landing page | http://localhost:4000 |
| Ops dashboard | http://localhost:5050 |

## Shared code

Canonical modules live in `shared/` (legal, landing-demo stream, json-viewer, clipboard, session-replay types, …).  
`npm run sync:shared` copies them into each app’s `lib/shared/` (and `public/json-viewer.html`). Dev/build scripts run this automatically — edit `shared/`, not the copies.

## Landing demo proxy (required for hosted deploys)

The landing page proxies `/api/landing-demo/*` to the Spine app. In production both apps must share the same secret:

1. Run `openssl rand -hex 32` and set `LANDING_DEMO_PROXY_SECRET` in the repo root `.env`.
2. Add the **same value** to **both** Vercel projects (landing page **and** Spine app) — Production environment.
3. **Redeploy both projects** after adding/changing the env var (Vercel does not pick up new secrets on already-running deployments).
4. On the landing Vercel project, set `SPINE_API_URL=https://www.spine-ai-app.dev` if it is not already.

If signup shows `unauthorized` / proxy errors: the secret is missing on one project, the values differ, or a redeploy was skipped. Check Spine function logs for `[landing-proxy-auth]` with `proxy_header_missing` vs `proxy_secret_mismatch`.

Local `npm run dev:all` injects a dev default secret automatically.

## Individual

App :
cd combined_full_stack
npm run dev -- -p 3000
http://localhost:3000


Landing page :
cd landing_page
npm run dev -- -p 4000
http://localhost:4000


Ops dashboard (localhost only) :
cd dashboard
npm install
npm run dev -- -p 5050
http://localhost:5050
(5000 is used)



testing emails must contain
spine-ai-dev-testing-account
