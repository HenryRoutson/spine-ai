# App & track remote

Generic React activity recording and replay for any React application.

## What this is

- **`shared/`** — drop-in modules any React app can import:
  - `useActivityRecorder` — records button clicks, form input, navigation, and client errors
  - `replayActivityEvents` — replays recorded events against live DOM (same markup)
- **`application_react/`** — sample signed-in app (task workspace) that uses the recorder
- **`recreate_application_activity/`** — ops dashboard: pick a user, view their timeline, replay UI in an iframe
- **`server/`** — minimal JSON-file API (sign-in, activity ingest, timeline)

## Run locally

From this folder:

```bash
npm install
npm install --prefix application_react
npm install --prefix recreate_application_activity
```

In one terminal:

```bash
npm run dev:all
```

Or in three terminals:

```bash
npm run dev                          # API on :5180
npm run dev --prefix application_react       # demo app on :5173 (/app/)
npm run dev --prefix recreate_application_activity  # dashboard on :5174 (/dashboard/)
```

Open:

- Demo app: http://localhost:5180/app/ (or http://localhost:5173/app/)
- Dashboard: http://localhost:5180/dashboard/ (or http://localhost:5174/dashboard/)

## Use in any React app

```tsx
import { useActivityRecorder } from "../shared/activity_recorder";

useActivityRecorder({
  userId: session?.userId ?? null,
  userEmail: session?.email,
  postUrl: "/api/activity",
  activeWindow: currentTabName,
});
```

Add `data-testid` on interactive elements for reliable replay matching.

## Replay

The dashboard loads the demo app in an iframe (`?replay=1` disables recording) and runs `replayActivityEvents` against the iframe document, highlighting each target as it goes.
