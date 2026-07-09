"use client";

import { useEffect, useRef } from "react";
import { API_ROUTES } from "@/lib/api-routes";
import { useOptionalStore } from "@/lib/store";
import type { session_id_string } from "@/lib/session-replay-types";

type rrweb_event_json = Record<string, unknown>;

const FLUSH_MS = 8_000;
const MAX_BUFFER = 40;
const SESSION_ROTATE_MS = 30 * 60_000;

function newSessionId(): session_id_string {
  return crypto.randomUUID() as session_id_string;
}

export function SessionReplayRecorder() {
  const store = useOptionalStore();
  const projectId = store?.project?.id;
  const sessionIdRef = useRef<session_id_string>(newSessionId());
  const chunkIndexRef = useRef(0);
  const bufferRef = useRef<rrweb_event_json[]>([]);
  const stopRecordRef = useRef<(() => void) | undefined>(undefined);
  const sessionStartedRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;

    const postChunk = (events: rrweb_event_json[], isFinal = false) => {
      const body: Record<string, unknown> = {
        sessionId: sessionIdRef.current,
        chunkIndex: chunkIndexRef.current,
        projectId,
        isFinal,
      };
      if (events.length > 0) {
        body.events = events;
        chunkIndexRef.current += 1;
      }
      void fetch(API_ROUTES.sessionReplay, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: isFinal,
      }).catch(() => {});
    };

    const flush = (isFinal = false) => {
      const events = bufferRef.current.splice(0, MAX_BUFFER);
      if (events.length === 0 && !isFinal) return;
      postChunk(events, isFinal);
    };

    const rotateSession = () => {
      flush(true);
      sessionIdRef.current = newSessionId();
      chunkIndexRef.current = 0;
      bufferRef.current = [];
      sessionStartedRef.current = Date.now();
    };

    void import("rrweb").then(({ record }) => {
      if (cancelled) return;
      stopRecordRef.current = record({
        emit(event) {
          bufferRef.current.push(event as rrweb_event_json);
          if (bufferRef.current.length >= MAX_BUFFER) flush();
          if (Date.now() - sessionStartedRef.current >= SESSION_ROTATE_MS) rotateSession();
        },
        // AI : passwords masked by default; other inputs visible for ops debugging.
        maskAllInputs: false,
        maskInputOptions: { password: true },
        blockSelector: "[data-no-track], [data-rr-block]",
        checkoutEveryNms: 5 * 60_000,
      });
    });

    const intervalId = setInterval(() => flush(), FLUSH_MS);
    const onPageHide = () => flush(true);
    window.addEventListener("pagehide", onPageHide);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      stopRecordRef.current?.();
      stopRecordRef.current = undefined;
      flush(true);
    };
  }, [projectId]);

  return null;
}
