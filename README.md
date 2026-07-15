# antler_vc_hackathon

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
2. Add the **same value** to both Vercel projects (landing page + Spine app).
3. On the landing Vercel project, set `SPINE_API_URL=https://www.spine-ai-app.dev` if it is not already.

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
