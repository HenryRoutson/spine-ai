import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { recordActivityEvent, useActivityRecorder } from "@shared/activity_recorder";
import { REPLAY_MSG_SOURCE } from "@shared/activity_replay_bridge";
import type { activity_event_row } from "@shared/activity_types";
import type { signed_in_user } from "@shared/activity_types";

type app_window = "home" | "tasks" | "settings";
type task_id = string;

type task_row = {
  id: task_id;
  title: string;
  done: boolean;
};

const API = "/api";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const INITIAL_TASKS: task_row[] = [
  { id: "1", title: "Review pipeline spec", done: false },
  { id: "2", title: "Ship activity tracker", done: true },
];

export function App() {
  const [user, setUser] = useState<signed_in_user | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeWindow, setActiveWindow] = useState<app_window>("home");
  const [tasks, setTasks] = useState<task_row[]>(INITIAL_TASKS);
  const [draftTitle, setDraftTitle] = useState("");
  const replayDraftRef = useRef("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [replayMode, setReplayMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReplayMode(params.get("replay") === "1");
  }, []);

  useEffect(() => {
    if (replayMode) {
      setBooting(false);
      setUser({ userId: "replay", email: "replay@demo.local", displayName: "Replay viewer" });
      return;
    }
    void fetch(`${API}/auth/me`)
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { user: signed_in_user };
        return body.user;
      })
      .then((u) => setUser(u))
      .finally(() => setBooting(false));
  }, [replayMode]);

  useActivityRecorder({
    userId: replayMode ? null : user?.userId ?? null,
    userEmail: user?.email,
    postUrl: `${API}/activity`,
    activeWindow,
    enabled: !replayMode,
  });

  const signIn = useCallback(async () => {
    const res = await fetch(`${API}/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, displayName }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { user: signed_in_user };
    setUser(body.user);
  }, [displayName, email]);

  const signOut = useCallback(async () => {
    if (user) {
      recordActivityEvent(`${API}/activity`, user.userId, user.email, "sign_out", "Signed out");
    }
    await fetch(`${API}/auth/sign-out`, { method: "POST" });
    setUser(null);
  }, [user]);

  const addTask = useCallback(() => {
    const title = draftTitle.trim();
    if (!title) return;
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), title, done: false }]);
    setDraftTitle("");
    replayDraftRef.current = "";
  }, [draftTitle]);

  const toggleTask = useCallback((id: task_id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, []);

  const resetReplayState = useCallback(() => {
    setActiveWindow("home");
    setTasks(INITIAL_TASKS);
    setDraftTitle("");
    replayDraftRef.current = "";
    setTheme("dark");
  }, []);

  const applyReplayEvent = useCallback(
    (event: activity_event_row): { ok: boolean; message: string } => {
      const flashTestId = (testId: string) => {
        const el = document.querySelector(`[data-testid="${CSS.escape(testId)}"]`);
        if (!(el instanceof HTMLElement)) return;
        const prev = el.style.outline;
        el.style.outline = "2px solid #635bff";
        window.setTimeout(() => {
          el.style.outline = prev;
        }, 480);
      };

      if (event.category === "ui_navigate") {
        const windowName = event.detail?.window;
        if (!windowName) return { ok: true, message: event.action };
        setActiveWindow(windowName as app_window);
        flashTestId(`nav-${windowName}`);
        return { ok: true, message: `Navigate: ${windowName}` };
      }

      if (event.category === "ui_click") {
        const testId =
          event.detail?.testId ??
          (event.action.startsWith("Clicked ") ? event.action.slice(8) : event.action);

        flashTestId(testId);

        if (testId === "go-tasks" || testId.startsWith("nav-")) {
          const windowName = testId === "go-tasks" ? "tasks" : testId.slice(4);
          setActiveWindow(windowName as app_window);
          return { ok: true, message: `Clicked ${testId}` };
        }

        if (testId === "add-task-button") {
          const title = replayDraftRef.current.trim();
          if (!title) return { ok: true, message: "Clicked add-task-button (empty title)" };
          setTasks((prev) => [...prev, { id: crypto.randomUUID(), title, done: false }]);
          setDraftTitle("");
          replayDraftRef.current = "";
          return { ok: true, message: `Added task "${title.slice(0, 80)}"` };
        }

        if (testId.startsWith("toggle-task-")) {
          toggleTask(testId.slice("toggle-task-".length));
          return { ok: true, message: `Clicked ${testId}` };
        }

        return { ok: false, message: `Unknown click target: ${testId}` };
      }

      if (event.category === "ui_input") {
        const testId = event.detail?.testId ?? event.detail?.field ?? "input";
        const value = event.detail?.value ?? "";
        flashTestId(testId);
        if (testId === "task-title-input") {
          replayDraftRef.current = value;
          setDraftTitle(value);
          return { ok: true, message: `Typed "${value.slice(0, 80)}" in ${testId}` };
        }
        if (testId === "theme-select") {
          setTheme(value === "light" ? "light" : "dark");
          return { ok: true, message: `Set theme = "${value}"` };
        }
        return { ok: false, message: `Unknown input: ${testId}` };
      }

      if (event.category === "error") {
        return {
          ok: true,
          message: event.detail?.message ? `Error: ${event.detail.message}` : event.action,
        };
      }

      return { ok: true, message: event.action };
    },
    [toggleTask],
  );

  useEffect(() => {
    if (!replayMode) return;

    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.source !== REPLAY_MSG_SOURCE.dashboard) return;

      if (ev.data.type === "REPLAY_RESET") {
        resetReplayState();
        return;
      }

      if (ev.data.type === "REPLAY_EVENT" && ev.data.event) {
        const event = ev.data.event as activity_event_row;
        const result = applyReplayEvent(event);
        window.parent.postMessage(
          {
            source: REPLAY_MSG_SOURCE.app,
            type: "REPLAY_STEP",
            eventId: event.id,
            ok: result.ok,
            message: result.message,
          },
          "*",
        );
      }
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ source: REPLAY_MSG_SOURCE.app, type: "REPLAY_READY" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [applyReplayEvent, replayMode, resetReplayState]);

  const openCount = useMemo(() => tasks.filter((t) => !t.done).length, [tasks]);

  if (booting) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user && !replayMode) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "1rem" }}>
        <div className="panel" style={{ width: "min(24rem, 100%)", padding: "1.5rem" }}>
          <h1 style={{ marginTop: 0 }}>Demo application</h1>
          <p className="muted">Sign in to start recording clicks and typed content.</p>
          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            <label>
              <span className="muted">Display name</span>
              <input
                data-testid="sign-in-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex"
              />
            </label>
            <label>
              <span className="muted">Email</span>
              <input
                data-testid="sign-in-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
              />
            </label>
            <button type="button" data-testid="sign-in-button" onClick={() => void signIn()}>
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "1.25rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Task workspace</h1>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {replayMode ? "Replay mode — actions are simulated from recorded events" : `Signed in as ${user?.displayName}`}
          </p>
        </div>
        {!replayMode ? (
          <button type="button" className="secondary" data-testid="sign-out-button" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : null}
      </header>

      <nav
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
        data-no-track={replayMode ? "true" : undefined}
      >
        {(["home", "tasks", "settings"] as const).map((w) => (
          <button
            key={w}
            type="button"
            className={activeWindow === w ? undefined : "secondary"}
            data-testid={`nav-${w}`}
            onClick={() => setActiveWindow(w)}
          >
            {w}
          </button>
        ))}
      </nav>

      {activeWindow === "home" ? (
        <section className="panel" style={{ padding: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>Overview</h2>
          <p>
            Open tasks: <strong>{openCount}</strong>
          </p>
          <button type="button" data-testid="go-tasks" onClick={() => setActiveWindow("tasks")}>
            Manage tasks
          </button>
        </section>
      ) : null}

      {activeWindow === "tasks" ? (
        <section className="panel" style={{ padding: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>Tasks</h2>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <input
              data-testid="task-title-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="New task title"
            />
            <button type="button" data-testid="add-task-button" onClick={addTask}>
              Add
            </button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
            {tasks.map((task) => (
              <li
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "0.65rem 0.75rem",
                }}
              >
                <span style={{ textDecoration: task.done ? "line-through" : "none", opacity: task.done ? 0.6 : 1 }}>
                  {task.title}
                </span>
                <button
                  type="button"
                  className="secondary"
                  data-testid={`toggle-task-${task.id}`}
                  onClick={() => toggleTask(task.id)}
                >
                  {task.done ? "Undo" : "Done"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeWindow === "settings" ? (
        <section className="panel" style={{ padding: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>Settings</h2>
          <label style={{ display: "grid", gap: "0.35rem", maxWidth: "16rem" }}>
            <span className="muted">Theme</span>
            <select
              data-testid="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value as "dark" | "light")}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
            Last loaded {formatWhen(new Date().toISOString())}
          </p>
        </section>
      ) : null}
    </div>
  );
}
