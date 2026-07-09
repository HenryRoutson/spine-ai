import { useEffect, useRef } from "react";
import {
  sanitizeActivityInputText,
  type activity_category,
  type activity_event_input,
} from "./activity_types";
import { buildSelector, elementLabel, inputFieldLabel } from "./dom_utils";

type pending_event = activity_event_input;

export type activity_recorder_options = {
  userId: string | null;
  userEmail?: string | null;
  projectId?: string;
  postUrl: string;
  flushMs?: number;
  maxQueue?: number;
  onNavigate?: (window: string) => void;
  activeWindow?: string;
  enabled?: boolean;
};

const DEFAULT_FLUSH_MS = 3_000;
const DEFAULT_MAX_QUEUE = 40;
const INPUT_DEBOUNCE_MS = 800;

type pending_input_snapshot = {
  field: string;
  value: string;
  selector: string;
  testId?: string;
  projectId?: string;
};

async function postBatch(
  postUrl: string,
  userId: string,
  userEmail: string | null | undefined,
  events: pending_event[],
): Promise<void> {
  await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, userEmail, events }),
  }).catch(() => {});
}

// AI : drop into any React app — records clicks, inputs, errors; batches to your API.
export function useActivityRecorder(options: activity_recorder_options): void {
  const {
    userId,
    userEmail,
    projectId,
    postUrl,
    flushMs = DEFAULT_FLUSH_MS,
    maxQueue = DEFAULT_MAX_QUEUE,
    activeWindow,
    enabled = true,
  } = options;

  const queueRef = useRef<pending_event[]>([]);
  const lastNavRef = useRef<string | null>(null);
  const inputTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingInputsRef = useRef(new Map<string, pending_input_snapshot>());
  const optsRef = useRef(options);
  optsRef.current = options;

  const enqueue = (event: pending_event) => {
    const q = queueRef.current;
    if (q.length >= maxQueue) q.shift();
    q.push(event);
  };

  const enqueueInputSnapshot = (key: string) => {
    const pending = pendingInputsRef.current.get(key);
    if (!pending || !optsRef.current.userId) return;
    pendingInputsRef.current.delete(key);
    enqueue({
      category: "ui_input",
      action: pending.value
        ? `Typed "${pending.value.slice(0, 80)}" in ${pending.field}`
        : `Typed in ${pending.field}`,
      detail: {
        field: pending.field,
        value: pending.value,
        length: pending.value.length,
        selector: pending.selector,
        testId: pending.testId,
      },
      projectId: pending.projectId,
    });
  };

  const flushPendingInput = (key: string) => {
    const timer = inputTimersRef.current.get(key);
    if (timer) clearTimeout(timer);
    inputTimersRef.current.delete(key);
    enqueueInputSnapshot(key);
  };

  const flushAllPendingInputs = () => {
    for (const key of [...inputTimersRef.current.keys()]) flushPendingInput(key);
  };

  const flush = () => {
    const uid = optsRef.current.userId;
    if (!uid || !optsRef.current.enabled) {
      queueRef.current = [];
      return;
    }
    flushAllPendingInputs();
    const batch = queueRef.current.splice(0, maxQueue);
    if (batch.length === 0) return;
    void postBatch(postUrl, uid, optsRef.current.userEmail, batch);
  };

  useEffect(() => {
    if (!enabled || !userId) return;
    const id = setInterval(flush, flushMs);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [enabled, userId, postUrl, flushMs, maxQueue]);

  useEffect(() => {
    if (!enabled || !userId || !activeWindow) return;
    if (lastNavRef.current === activeWindow) return;
    lastNavRef.current = activeWindow;
    enqueue({
      category: "ui_navigate",
      action: `Opened ${activeWindow}`,
      detail: { window: activeWindow },
      projectId,
    });
  }, [enabled, userId, activeWindow, projectId]);

  useEffect(() => {
    if (!enabled) return;

    const onClick = (ev: MouseEvent) => {
      if (!optsRef.current.userId) return;
      // AI : flush typed text before click handlers clear controlled inputs.
      flushAllPendingInputs();
      const target = ev.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("button, a[href], [role='button']");
      if (!btn || !(btn instanceof HTMLElement)) return;
      if (btn.closest("[data-no-track]")) return;
      enqueue({
        category: "ui_click",
        action: `Clicked ${elementLabel(btn)}`,
        detail: {
          tag: btn.tagName.toLowerCase(),
          selector: buildSelector(btn),
          testId: btn.getAttribute("data-testid") ?? undefined,
        },
        projectId: optsRef.current.projectId,
      });
    };

    const captureInput = (
      target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    ) => {
      if (!optsRef.current.userId) return;
      if (target instanceof HTMLInputElement && target.type === "password") return;
      if (target.closest("[data-no-track]")) return;

      const field = inputFieldLabel(target);
      const key = target.id || target.name || field;
      const value = sanitizeActivityInputText(target.value);

      pendingInputsRef.current.set(key, {
        field,
        value,
        selector: buildSelector(target),
        testId: target.getAttribute("data-testid") ?? undefined,
        projectId: optsRef.current.projectId,
      });

      const existing = inputTimersRef.current.get(key);
      if (existing) clearTimeout(existing);
      inputTimersRef.current.set(
        key,
        setTimeout(() => flushPendingInput(key), INPUT_DEBOUNCE_MS),
      );
    };

    const onInput = (ev: Event) => {
      const target = ev.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      captureInput(target);
    };

    const onChange = (ev: Event) => {
      const target = ev.target;
      if (!(target instanceof HTMLSelectElement)) return;
      captureInput(target);
    };

    const onBlur = (ev: Event) => {
      const target = ev.target;
      if (
        !(target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) {
        return;
      }
      const key = target.id || target.name || inputFieldLabel(target);
      flushPendingInput(key);
    };

    const onError = (ev: ErrorEvent) => {
      if (!optsRef.current.userId) return;
      enqueue({
        category: "error",
        action: "Client error",
        detail: { message: (ev.message ?? "unknown").slice(0, 500), source: ev.filename },
        projectId: optsRef.current.projectId,
      });
    };

    const onRejection = (ev: PromiseRejectionEvent) => {
      if (!optsRef.current.userId) return;
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
        projectId: optsRef.current.projectId,
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("focusout", onBlur, true);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("focusout", onBlur, true);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      flushAllPendingInputs();
      for (const t of inputTimersRef.current.values()) clearTimeout(t);
      inputTimersRef.current.clear();
      pendingInputsRef.current.clear();
    };
  }, [enabled, projectId]);
}

export function recordActivityEvent(
  postUrl: string,
  userId: string,
  userEmail: string | null | undefined,
  category: activity_category,
  action: string,
  detail?: pending_event["detail"],
): void {
  void postBatch(postUrl, userId, userEmail, [{ category, action, detail }]);
}
