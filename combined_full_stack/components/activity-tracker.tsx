"use client";

import { useEffect, useRef } from "react";
import { API_ROUTES } from "@/lib/api-routes";
import { sanitizeActivityInputText, type activity_category } from "@/lib/activity-types";
import { useAppShell } from "@/lib/app-shell";
import { useOptionalStore } from "@/lib/store";

type pending_event = {
  category: activity_category;
  action: string;
  detail?: Record<string, unknown>;
  projectId?: string;
};

const FLUSH_MS = 4_000;
const MAX_QUEUE = 40;

function elementLabel(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.slice(0, 200);
  const title = el.getAttribute("title");
  if (title) return title.slice(0, 200);
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 200);
  const name = el.getAttribute("name");
  if (name) return name.slice(0, 200);
  return el.tagName.toLowerCase();
}

function inputFieldLabel(el: HTMLInputElement | HTMLTextAreaElement): string {
  const id = el.id;
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) return label.textContent.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return el.getAttribute("placeholder") ?? el.getAttribute("name") ?? el.tagName.toLowerCase();
}

export function ActivityTracker() {
  const { activeWindow } = useAppShell();
  const store = useOptionalStore();
  const queueRef = useRef<pending_event[]>([]);
  const lastNavRef = useRef<string | null>(null);
  const inputTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const projectId = store?.project?.id;

  const enqueue = (event: pending_event) => {
    const q = queueRef.current;
    if (q.length >= MAX_QUEUE) q.shift();
    q.push(event);
  };

  const flush = () => {
    const batch = queueRef.current.splice(0, MAX_QUEUE);
    if (batch.length === 0) return;
    void fetch(API_ROUTES.activity, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch.map((e) => ({ ...e, projectId: e.projectId ?? projectId })) }),
    }).catch(() => {});
  };

  useEffect(() => {
    const id = setInterval(flush, FLUSH_MS);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [projectId]);

  useEffect(() => {
    if (lastNavRef.current === activeWindow) return;
    lastNavRef.current = activeWindow;
    enqueue({ category: "ui_navigate", action: `Opened ${activeWindow}`, detail: { window: activeWindow } });
  }, [activeWindow]);

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const target = ev.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("button, a[href], [role='button']");
      if (!btn || !(btn instanceof HTMLElement)) return;
      if (btn.closest("[data-no-track]")) return;
      enqueue({
        category: "ui_click",
        action: `Clicked ${elementLabel(btn)}`,
        detail: { tag: btn.tagName.toLowerCase() },
      });
    };

    const onInput = (ev: Event) => {
      const target = ev.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (target.type === "password") return;
      if (target.closest("[data-no-track]")) return;
      const key = target.id || target.name || inputFieldLabel(target);
      const existing = inputTimersRef.current.get(key);
      if (existing) clearTimeout(existing);
      inputTimersRef.current.set(
        key,
        setTimeout(() => {
          inputTimersRef.current.delete(key);
          enqueue({
            category: "ui_input",
            action: `Typed in ${inputFieldLabel(target)}`,
            detail: {
              field: inputFieldLabel(target),
              value: sanitizeActivityInputText(target.value),
              length: target.value.length,
            },
          });
        }, 1_200),
      );
    };

    const onError = (ev: ErrorEvent) => {
      enqueue({
        category: "error",
        action: "Client error",
        detail: { message: (ev.message ?? "unknown").slice(0, 500), source: ev.filename },
      });
    };

    const onRejection = (ev: PromiseRejectionEvent) => {
      const message =
        ev.reason instanceof Error
          ? ev.reason.message
          : typeof ev.reason === "string"
            ? ev.reason
            : "Unhandled rejection";
      enqueue({
        category: "error",
        action: "Unhandled promise rejection",
        detail: { message: message.slice(0, 500) },
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      for (const t of inputTimersRef.current.values()) clearTimeout(t);
      inputTimersRef.current.clear();
    };
  }, [projectId]);

  return null;
}
