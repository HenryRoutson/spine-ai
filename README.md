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
