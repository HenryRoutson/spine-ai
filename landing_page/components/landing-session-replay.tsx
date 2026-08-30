"use client";

import { useEffect, useRef } from "react";
import type { demo_email_string } from "@/lib/demo-email";
import { SESSION_REPLAY_ENABLED } from "@/lib/session-replay-enabled";
import {
  createReplayMetaBuffer,
  currentPagePath,
  elementClickLabel,
} from "@shared/session-replay/recorder-meta";

type rrweb_event_json = Record<string, unknown>;
type session_id_string = string & { __brand: "session_id" };

const FLUSH_MS = 8_000;
const MAX_BUFFER = 40;
const SESSION_ROTATE_MS = 30 * 60_000;
const REPLAY_PATH = "/api/landing-demo/session-replay";

function newSessionId(): session_id_string {
  return crypto.randomUUID() as session_id_string;
}

// AI : rrweb recorder for anonymous landing visitors — posts via landing proxy after email signup.
export function LandingSessionReplayRecorder({
  email,
  enabled,
  buildId,
}: {
  email: demo_email_string | null;
  enabled: boolean;
  buildId?: string | null;
}) {
  const sessionIdRef = useRef<session_id_string>(newSessionId());
  const chunkIndexRef = useRef(0);
  const bufferRef = useRef<rrweb_event_json[]>([]);
  const metaRef = useRef(createReplayMetaBuffer(currentPagePath()));
  const stopRecordRef = useRef<(() => void) | undefined>(undefined);
  const sessionStartedRef = useRef(Date.now());
  const emailRef = useRef(email);
  const buildIdRef = useRef(buildId);

  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  useEffect(() => {
    buildIdRef.current = buildId;
  }, [buildId]);

  useEffect(() => {
    if (!SESSION_REPLAY_ENABLED || !enabled || !email) return;
    let cancelled = false;
    metaRef.current.recordPage(currentPagePath());

    const postChunk = (events: rrweb_event_json[], isFinal = false) => {
      const currentEmail = emailRef.current;
      if (!currentEmail) return;
      const meta = metaRef.current.drain();

      const body: Record<string, unknown> = {
        sessionId: sessionIdRef.current,
        email: currentEmail,
        privacyAccepted: true,
        chunkIndex: chunkIndexRef.current,
        isFinal,
      };
      if (buildIdRef.current) body.projectId = buildIdRef.current;
      if (events.length > 0) {
        body.events = events;
        chunkIndexRef.current += 1;
      }
      if (meta.pages.length > 0) body.pages = meta.pages;
      if (meta.clickedComponents.length > 0) body.clickedComponents = meta.clickedComponents;
      void fetch(REPLAY_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: isFinal,
      }).then(async (res) => {
        // AI : stop flushing on kill switch — 503 used to spam the console every 8s.
        if (!res.ok) {
          cancelled = true;
          return;
        }
        try {
          const data = (await res.json()) as { disabled?: boolean };
          if (data.disabled) cancelled = true;
        } catch {
          /* non-JSON success */
        }
      }).catch(() => {});
    };

    const flush = (isFinal = false) => {
      if (cancelled) return;
      const events = bufferRef.current.splice(0, MAX_BUFFER);
      // AI : still flush when click/page meta accumulated without a full rrweb buffer.
      if (events.length === 0 && !isFinal && !metaRef.current.hasPending()) return;
      postChunk(events, isFinal);
    };

    const rotateSession = () => {
      flush(true);
      sessionIdRef.current = newSessionId();
      chunkIndexRef.current = 0;
      bufferRef.current = [];
      metaRef.current = createReplayMetaBuffer(currentPagePath());
      sessionStartedRef.current = Date.now();
    };

    const onClick = (ev: MouseEvent) => {
      const target = ev.target;
      if (!(target instanceof HTMLElement)) return;
      const el = target.closest("button, a[href], [role='button'], input, textarea, select");
      if (!el || !(el instanceof HTMLElement)) return;
      if (el.closest("[data-no-track]")) return;
      metaRef.current.recordClick(elementClickLabel(el, "landing"));
    };

    void import("rrweb").then(({ record }) => {
      if (cancelled) return;
      stopRecordRef.current = record({
        emit(event) {
          bufferRef.current.push(event as rrweb_event_json);
          if (bufferRef.current.length >= MAX_BUFFER) flush();
          if (Date.now() - sessionStartedRef.current >= SESSION_ROTATE_MS) rotateSession();
        },
        maskAllInputs: false,
        maskInputOptions: { password: true },
        blockClass: "rr-block",
        checkoutEveryNms: 5 * 60_000,
      });
    });

    document.addEventListener("click", onClick, true);
    const intervalId = setInterval(() => flush(), FLUSH_MS);
    const onPageHide = () => flush(true);
    window.addEventListener("pagehide", onPageHide);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("click", onClick, true);
      clearInterval(intervalId);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      stopRecordRef.current?.();
      stopRecordRef.current = undefined;
      flush(true);
    };
  }, [enabled, email]);

  return null;
}
