import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  replayActivityEventsViaPostMessage,
  waitForReplayAppReady,
} from "@shared/activity_replay_bridge";
import {
  filterReplayableEvents,
  type replay_step_result,
} from "@shared/activity_replayer";
import type { activity_event_row } from "@shared/activity_types";

type user_summary = {
  userId: string;
  email: string;
  displayName: string;
  eventCount: number;
  lastActiveAt: string | null;
};

const API = "/api";
const APP_REPLAY_URL = "/app/?replay=1";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function categoryColor(category: string): string {
  if (category === "error") return "var(--bad)";
  if (category === "ui_input") return "var(--ok)";
  if (category === "ui_click") return "var(--accent)";
  return "var(--muted)";
}

export function Dashboard() {
  const [users, setUsers] = useState<user_summary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [events, setEvents] = useState<activity_event_row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayPaused, setReplayPaused] = useState(false);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [replayLog, setReplayLog] = useState<replay_step_result[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const replayAbortRef = useRef(0);
  const replayPausedRef = useRef(false);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const runReplayRef = useRef<(untilEventId?: string) => Promise<void>>(async () => {});

  const refreshUsers = useCallback(async () => {
    const res = await fetch(`${API}/users`);
    if (!res.ok) throw new Error(`users HTTP ${res.status}`);
    const body = (await res.json()) as { users: user_summary[] };
    setUsers(body.users);
    if (!selectedUserId && body.users.length > 0) setSelectedUserId(body.users[0].userId);
  }, [selectedUserId]);

  const refreshTimeline = useCallback(async (userId: string) => {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`${API}/timeline${qs}`);
    if (!res.ok) throw new Error(`timeline HTTP ${res.status}`);
    const body = (await res.json()) as { events: activity_event_row[] };
    setEvents(body.events);
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await refreshUsers();
      if (selectedUserId) await refreshTimeline(selectedUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [refreshTimeline, refreshUsers, selectedUserId]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    void refreshTimeline(selectedUserId).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load timeline"),
    );
  }, [selectedUserId, refreshTimeline]);

  const replayable = useMemo(() => filterReplayableEvents(events), [events]);
  const selectedUser = users.find((u) => u.userId === selectedUserId);

  const chronologicalReplayable = useMemo(
    () =>
      [...replayable].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [replayable],
  );

  const runReplay = useCallback(
    async (untilEventId?: string) => {
      if (replayable.length === 0) return;

      const runId = replayAbortRef.current + 1;
      replayAbortRef.current = runId;
      replayPausedRef.current = false;
      setReplayPaused(false);
      setReplaying(true);
      setReplayLog([]);
      setReplayIndex(null);

      const eventsToPlay = untilEventId
        ? (() => {
            const idx = chronologicalReplayable.findIndex((e) => e.id === untilEventId);
            return idx >= 0 ? chronologicalReplayable.slice(0, idx + 1) : chronologicalReplayable;
          })()
        : chronologicalReplayable;

      if (eventsToPlay.length === 0) {
        setReplaying(false);
        return;
      }

      const iframe = iframeRef.current;
      if (!iframe) {
        setReplaying(false);
        return;
      }

      const readyPromise = waitForReplayAppReady(iframe);
      iframe.src = APP_REPLAY_URL;
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
      });

      if (replayAbortRef.current !== runId) return;

      const ready = await readyPromise;
      if (!ready) {
        setError("Replay app did not finish loading");
        setReplaying(false);
        return;
      }

      if (replayAbortRef.current !== runId) return;

      await replayActivityEventsViaPostMessage(iframe, eventsToPlay, {
        speedMs: untilEventId ? 350 : 550,
        shouldAbort: () => replayAbortRef.current !== runId,
        shouldPause: () => replayPausedRef.current,
        onStep: (result) => {
          if (replayAbortRef.current !== runId) return;
          const idx = chronologicalReplayable.findIndex((e) => e.id === result.event.id);
          setReplayIndex(idx >= 0 ? idx : null);
          setReplayLog((prev) => [...prev, result]);
        },
      });

      if (replayAbortRef.current !== runId) return;
      setReplayIndex(untilEventId ? chronologicalReplayable.findIndex((e) => e.id === untilEventId) : null);
      replayPausedRef.current = false;
      setReplayPaused(false);
      setReplaying(false);
    },
    [chronologicalReplayable, replayable.length],
  );

  runReplayRef.current = runReplay;

  const replaySignature = `${selectedUserId}:${events.map((e) => e.id).join(",")}`;

  useEffect(() => {
    if (!selectedUserId || replayable.length === 0) return;
    void runReplayRef.current();
    return () => {
      replayAbortRef.current += 1;
    };
  }, [replaySignature, replayable.length, selectedUserId]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [replayIndex]);

  const clearHistory = useCallback(
    async (scope: "user" | "all") => {
      const label =
        scope === "all"
          ? "all activity history for every user"
          : `all activity history for ${selectedUser?.displayName ?? "this user"}`;
      if (!window.confirm(`Clear ${label}? This cannot be undone.`)) return;

      setClearing(true);
      setError(null);
      replayAbortRef.current += 1;
      try {
        const qs = scope === "user" && selectedUserId ? `?userId=${encodeURIComponent(selectedUserId)}` : "";
        const res = await fetch(`${API}/history${qs}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`clear HTTP ${res.status}`);
        setEvents([]);
        setReplayLog([]);
        setReplayIndex(null);
        await refreshUsers();
        if (selectedUserId) await refreshTimeline(selectedUserId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to clear history");
      } finally {
        setClearing(false);
      }
    },
    [refreshTimeline, refreshUsers, selectedUser?.displayName, selectedUserId],
  );

  return (
    <div style={{ maxWidth: "90rem", margin: "0 auto", padding: "1.25rem" }}>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: "0 0 0.35rem" }}>Activity dashboard</h1>
        <p className="muted" style={{ margin: 0 }}>
          Select a signed-in user and inspect their timeline. Replay recreates clicks and typed content in the demo app.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(18rem, 22rem) 1fr",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        <aside className="panel" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Users</h2>
            <button type="button" className="secondary" onClick={() => void refresh()} disabled={busy}>
              Refresh
            </button>
          </div>

          <label style={{ display: "grid", gap: "0.35rem", marginBottom: "1rem" }}>
            <span className="muted">Signed-in user</span>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">— select —</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName} ({u.eventCount} events)
                </option>
              ))}
            </select>
          </label>

          {selectedUser ? (
            <div className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
              <div>{selectedUser.email}</div>
              <div>Last active: {selectedUser.lastActiveAt ? formatWhen(selectedUser.lastActiveAt) : "—"}</div>
            </div>
          ) : null}

          {error ? <p style={{ color: "var(--bad)", fontSize: "0.85rem" }}>{error}</p> : null}

          <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => {
                replayAbortRef.current += 1;
                void runReplay();
              }}
              disabled={!selectedUserId || replayable.length === 0 || replaying || clearing}
            >
              {replaying ? (replayPaused ? "Paused" : "Replaying…") : `Replay ${replayable.length} UI events`}
            </button>
            {replaying ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  replayPausedRef.current = !replayPausedRef.current;
                  setReplayPaused(replayPausedRef.current);
                }}
              >
                {replayPaused ? "Resume replay" : "Pause replay"}
              </button>
            ) : null}
            <button
              type="button"
              className="secondary"
              disabled={!selectedUserId || replaying || clearing}
              onClick={() => void clearHistory("user")}
            >
              {clearing ? "Clearing…" : "Clear user history"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={replaying || clearing}
              onClick={() => void clearHistory("all")}
            >
              Clear all history
            </button>
            <a className="muted" href="/app/" style={{ fontSize: "0.85rem" }}>
              Open live demo app →
            </a>
          </div>
        </aside>

        <main style={{ display: "grid", gap: "1rem" }}>
          <section className="panel" style={{ padding: "1rem", minHeight: "22rem" }}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Live replay</h2>
            <div
              style={{
                height: "28rem",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                overflow: "hidden",
                pointerEvents: replaying ? "none" : "auto",
              }}
            >
              <iframe ref={iframeRef} className="replay-frame" title="Application replay" src={APP_REPLAY_URL} />
            </div>
            {replayLog.length > 0 ? (
              <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
                {replayPaused ? "Paused — " : ""}
                Last step: {replayLog[replayLog.length - 1]?.message}
              </p>
            ) : null}
          </section>

          <section className="panel" style={{ padding: "1rem" }}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
              Timeline {selectedUser ? `— ${selectedUser.displayName}` : ""}
            </h2>
            {events.length === 0 ? (
              <p className="muted">No events yet — sign in to the demo app and interact with it.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.5rem", maxHeight: "24rem", overflow: "auto" }}>
                {events.map((row) => {
                  const replayIdx = chronologicalReplayable.findIndex((e) => e.id === row.id);
                  const isReplayable = replayIdx >= 0;
                  const isActive = replayIndex != null && replayIdx === replayIndex;
                  const failed = replayLog.find((r) => r.event.id === row.id && !r.ok);
                  return (
                    <div
                      key={row.id}
                      ref={isActive ? activeRowRef : undefined}
                      role={isReplayable ? "button" : undefined}
                      tabIndex={isReplayable ? 0 : undefined}
                      onClick={() => {
                        if (!isReplayable || replaying) return;
                        replayAbortRef.current += 1;
                        void runReplay(row.id);
                      }}
                      onKeyDown={(e) => {
                        if (!isReplayable || replaying) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          replayAbortRef.current += 1;
                          void runReplay(row.id);
                        }
                      }}
                      className={`timeline-row${isActive ? " active" : ""}${failed ? " failed" : ""}${isReplayable ? " clickable" : ""}`}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.75rem" }}>
                        <span className="badge" style={{ color: categoryColor(row.category) }}>
                          {row.category}
                        </span>
                        <span className="muted">{formatWhen(row.createdAt)}</span>
                      </div>
                      <p style={{ margin: "0.35rem 0 0" }}>{row.action}</p>
                      {row.category === "ui_input" ? (
                        <p className="muted" style={{ margin: "0.35rem 0 0", fontFamily: "monospace", fontSize: "0.78rem" }}>
                          {row.detail?.value != null && row.detail.value !== ""
                            ? `"${String(row.detail.value).slice(0, 200)}"`
                            : "(empty)"}
                        </p>
                      ) : null}
                      {row.category === "error" && row.detail?.message ? (
                        <p style={{ margin: "0.35rem 0 0", color: "var(--bad)", fontSize: "0.85rem" }}>
                          {String(row.detail.message)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
