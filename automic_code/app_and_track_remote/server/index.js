// AI : minimal API — sign-in, activity ingest, timeline fetch for demo + any React client.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const PORT = 5180;
const APP_DEV_PORT = 5173;
const DASHBOARD_DEV_PORT = 5174;
const STATE_FILE = path.join(import.meta.dirname, "state.json");
const ROOT = path.join(import.meta.dirname, "..");

/** @typedef {{ userId: string, email: string, displayName: string, signedInAt: string }} user_row */
/** @typedef {{ id: string, userId: string, userEmail: string | null, category: string, action: string, detail: object, projectId: string | null, createdAt: string }} event_row */

const loadState = () =>
  fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
    : { users: {}, sessions: {}, events: [] };

const saveState = (/** @type {object} */ state) =>
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const app = express();
app.use(express.json({ limit: "1mb" }));

function parseSession(req) {
  const raw = req.headers.cookie ?? "";
  const match = raw.match(/(?:^|;\s*)track_session=([^;]+)/);
  if (!match) return null;
  const state = loadState();
  return state.sessions[match[1]] ?? null;
}

function json(res, status, body) {
  res.status(status).json(body);
}

app.post("/api/auth/sign-in", (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const displayName = String(req.body?.displayName ?? "").trim();
  if (!email || !displayName) return json(res, 400, { error: "email and displayName required" });

  const state = loadState();
  let user = Object.values(state.users).find((/** @type {user_row} */ u) => u.email === email);
  if (!user) {
    const userId = crypto.randomUUID();
    user = { userId, email, displayName, signedInAt: new Date().toISOString() };
    state.users[userId] = user;
  } else {
    user.displayName = displayName;
    user.signedInAt = new Date().toISOString();
  }

  const token = crypto.randomUUID();
  state.sessions[token] = { userId: user.userId, email: user.email, displayName: user.displayName };
  state.events.push({
    id: crypto.randomUUID(),
    userId: user.userId,
    userEmail: user.email,
    category: "sign_in",
    action: `Signed in as ${displayName}`,
    detail: { email },
    projectId: null,
    createdAt: new Date().toISOString(),
  });
  saveState(state);

  res.setHeader(
    "Set-Cookie",
    `track_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
  );
  json(res, 200, { user });
});

app.post("/api/auth/sign-out", (req, res) => {
  const session = parseSession(req);
  if (session) {
    const state = loadState();
    state.events.push({
      id: crypto.randomUUID(),
      userId: session.userId,
      userEmail: session.email,
      category: "sign_out",
      action: "Signed out",
      detail: {},
      projectId: null,
      createdAt: new Date().toISOString(),
    });
    saveState(state);
  }
  res.setHeader("Set-Cookie", "track_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  json(res, 200, { ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const session = parseSession(req);
  if (!session) return json(res, 401, { error: "not signed in" });
  json(res, 200, { user: session });
});

app.post("/api/activity", (req, res) => {
  const session = parseSession(req);
  const userId = session?.userId ?? req.body?.userId;
  if (!userId) return json(res, 401, { error: "not signed in" });

  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  if (events.length === 0) return json(res, 200, { ok: true });

  const state = loadState();
  const userEmail = session?.email ?? req.body?.userEmail ?? state.users[userId]?.email ?? null;
  let nowMs = Date.now();
  for (const e of events.slice(0, 50)) {
    state.events.push({
      id: crypto.randomUUID(),
      userId,
      userEmail,
      category: String(e.category ?? "ui_click"),
      action: String(e.action ?? "").slice(0, 500),
      detail: e.detail && typeof e.detail === "object" ? e.detail : {},
      projectId: e.projectId ?? null,
      createdAt: new Date(nowMs).toISOString(),
    });
    nowMs += 1;
  }
  saveState(state);
  json(res, 200, { ok: true, count: events.length });
});

app.get("/api/users", (_req, res) => {
  const state = loadState();
  const users = Object.values(state.users).map((/** @type {user_row} */ u) => {
    const userEvents = state.events.filter((/** @type {event_row} */ e) => e.userId === u.userId);
    const lastActiveAt =
      userEvents.length > 0
        ? userEvents[userEvents.length - 1].createdAt
        : u.signedInAt;
    return {
      userId: u.userId,
      email: u.email,
      displayName: u.displayName,
      eventCount: userEvents.length,
      lastActiveAt,
    };
  });
  users.sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
  json(res, 200, { users });
});

app.get("/api/timeline", (req, res) => {
  const userId = String(req.query.userId ?? "");
  const state = loadState();
  let events = state.events;
  if (userId) events = events.filter((/** @type {event_row} */ e) => e.userId === userId);
  events = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500);
  json(res, 200, { events });
});

app.delete("/api/history", (req, res) => {
  const userId = String(req.query.userId ?? "");
  const state = loadState();
  const before = state.events.length;
  state.events = userId
    ? state.events.filter((/** @type {event_row} */ e) => e.userId !== userId)
    : [];
  saveState(state);
  json(res, 200, { ok: true, removed: before - state.events.length });
});

// AI : proxy Vite dev servers — pathFilter keeps full /app|/dashboard prefix (Express mount would strip it).
const proxyOpts = { changeOrigin: true, ws: true };
app.use(
  createProxyMiddleware({
    target: `http://localhost:${APP_DEV_PORT}`,
    ...proxyOpts,
    pathFilter: (pathname) => pathname.startsWith("/app"),
  }),
);
app.use(
  createProxyMiddleware({
    target: `http://localhost:${DASHBOARD_DEV_PORT}`,
    ...proxyOpts,
    pathFilter: (pathname) => pathname.startsWith("/dashboard"),
  }),
);

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Activity track demo</title>
<style>body{font-family:system-ui;background:#0f1117;color:#e6e6e6;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#1a1d26;border:1px solid #2a2e3a;border-radius:12px;padding:2rem;text-align:center;max-width:28rem}
a{color:#635bff;text-decoration:none;font-weight:600;display:block;margin:0.75rem 0}</style></head>
<body><div class="card"><h1>App &amp; track remote</h1>
<p>Sample React app records clicks and typing. Dashboard replays a user's session.</p>
<a href="/app/">Demo application →</a>
<a href="/dashboard/">Activity dashboard →</a>
</div></body></html>`);
});

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`API + router http://localhost:${PORT}`);
  console.log(`  app       → http://localhost:${PORT}/app/  (vite :${APP_DEV_PORT})`);
  console.log(`  dashboard → http://localhost:${PORT}/dashboard/  (vite :${DASHBOARD_DEV_PORT})`);
});
