"use client";

import { useEffect, useRef } from "react";
import { API_ROUTES } from "@/lib/api-routes";
import { useOptionalAppShell } from "@/lib/app-shell";
import { useOptionalStore } from "@/lib/store";
import type { session_id_string } from "@/lib/session-replay-types";
import {
  createReplayMetaBuffer,
  currentPagePath,
  elementClickLabel,
} from "@shared/session-replay/recorder-meta";

type rrweb_event_json = Record<string, unknown>;

const FLUSH_MS = 8_000;
const MAX_BUFFER = 40;
const SESSION_ROTATE_MS = 30 * 60_000;

function newSessionId(): session_id_string {
  return crypto.randomUUID() as session_id_string;
}

export function SessionReplayRecorder() {
  const shell = useOptionalAppShell();
  const store = useOptionalStore();
  const projectId = store?.project?.id;
  const activeWindow = shell?.activeWindow ?? null;
  const sessionIdRef = useRef<session_id_string>(newSessionId());
  const chunkIndexRef = useRef(0);
  const bufferRef = useRef<rrweb_event_json[]>([]);
  const metaRef = useRef(createReplayMetaBuffer(currentPagePath()));
  const stopRecordRef = useRef<(() => void) | undefined>(undefined);
  const sessionStartedRef = useRef(Date.now());
  const activeWindowRef = useRef(activeWindow);

  useEffect(() => {
    activeWindowRef.current = activeWindow;
    if (activeWindow) metaRef.current.recordPage(`app:${activeWindow}`);
  }, [activeWindow]);

  useEffect(() => {
    let cancelled = false;

    const postChunk = (events: rrweb_event_json[], isFinal = false) => {
      const meta = metaRef.current.drain();

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
      if (meta.pages.length > 0) body.pages = meta.pages;
      if (meta.clickedComponents.length > 0) body.clickedComponents = meta.clickedComponents;
      void fetch(API_ROUTES.sessionReplay, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: isFinal,
      }).catch(() => {});
    };

    const flush = (isFinal = false) => {
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
      metaRef.current.recordClick(elementClickLabel(el, activeWindowRef.current));
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
  }, [projectId]);

  return null;
}
