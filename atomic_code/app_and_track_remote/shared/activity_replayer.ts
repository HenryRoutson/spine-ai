import type { activity_event_row } from "./activity_types";
import {
  detectActiveNavWindow,
  findClickTarget,
  findInputTarget,
  highlightElement,
  replayClick,
  replayInputValue,
} from "./dom_utils";

export type replay_step_result = {
  event: activity_event_row;
  ok: boolean;
  message: string;
};

export type activity_replayer_options = {
  speedMs?: number;
  doc?: Document;
  onStep?: (result: replay_step_result) => void;
  onComplete?: () => void;
  shouldAbort?: () => boolean;
};

const DEFAULT_SPEED_MS = 900;

function parseClickLabel(action: string): string {
  const prefix = "Clicked ";
  return action.startsWith(prefix) ? action.slice(prefix.length) : action;
}

function parseInputField(action: string): string {
  const prefix = "Typed in ";
  return action.startsWith(prefix) ? action.slice(prefix.length) : action;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForActiveWindow(
  doc: Document,
  windowName: string,
  timeoutMs = 2_500,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (detectActiveNavWindow(doc) === windowName) return true;
    await sleep(50);
  }
  return false;
}

async function waitForInputTarget(
  field: string,
  doc: Document,
  hints?: { selector?: string; testId?: string },
  timeoutMs = 2_500,
): Promise<HTMLInputElement | HTMLTextAreaElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = findInputTarget(field, doc, hints);
    if (el) return el;
    await sleep(50);
  }
  return null;
}

async function waitForClickTarget(
  label: string,
  tag: string | undefined,
  doc: Document,
  hints?: { selector?: string; testId?: string },
  timeoutMs = 2_500,
): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = findClickTarget(label, tag, doc, hints);
    if (el) return el;
    await sleep(50);
  }
  return null;
}

function windowFromNavLabel(label: string): string | null {
  return label.startsWith("nav-") ? label.slice(4) : null;
}

function eventHints(event: activity_event_row): { selector?: string; testId?: string } {
  return { selector: event.detail?.selector, testId: event.detail?.testId };
}

// AI : replays recorded events against live DOM — works on any React app with same markup.
export async function replayActivityEvents(
  events: activity_event_row[],
  options: activity_replayer_options = {},
): Promise<replay_step_result[]> {
  const { speedMs = DEFAULT_SPEED_MS, doc = document, onStep, onComplete, shouldAbort } = options;
  const chronological = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const results: replay_step_result[] = [];
  let clearHighlight: (() => void) | null = null;
  let activeWindow: string | null = detectActiveNavWindow(doc);

  for (const event of chronological) {
    if (shouldAbort?.()) break;

    if (clearHighlight) {
      clearHighlight();
      clearHighlight = null;
    }

    let ok = true;
    let message = "Skipped";
    const hints = eventHints(event);

    if (event.category === "ui_click") {
      const label = parseClickLabel(event.action);
      const el = await waitForClickTarget(label, event.detail?.tag, doc, hints);
      if (!el) {
        ok = false;
        message = `Could not find click target: ${label}`;
      } else {
        clearHighlight = highlightElement(el);
        replayClick(el);
        const navWindow = windowFromNavLabel(label) ?? windowFromNavLabel(hints.testId ?? "");
        if (label === "go-tasks") await waitForActiveWindow(doc, "tasks");
        else if (navWindow) await waitForActiveWindow(doc, navWindow);
        else await sleep(120);
        if (navWindow) activeWindow = navWindow;
        else if (label === "go-tasks") activeWindow = "tasks";
        message = `Clicked ${label}`;
      }
    } else if (event.category === "ui_input") {
      const field = event.detail?.field ?? parseInputField(event.action);
      const value = event.detail?.value ?? "";
      const el = await waitForInputTarget(field, doc, hints);
      if (!el) {
        ok = false;
        message = `Could not find input: ${field}`;
      } else {
        clearHighlight = highlightElement(el);
        replayInputValue(el, value);
        message = `Set ${field} = "${value.slice(0, 80)}"`;
      }
    } else if (event.category === "ui_navigate") {
      const windowName = event.detail?.window;
      if (windowName) {
        if (activeWindow === windowName) {
          message = `Already on ${windowName}`;
        } else {
          const navLabel = `nav-${windowName}`;
          const nav = await waitForClickTarget(navLabel, "button", doc, { testId: navLabel });
          if (nav) {
            clearHighlight = highlightElement(nav);
            replayClick(nav);
            const landed = await waitForActiveWindow(doc, windowName);
            ok = landed;
            activeWindow = landed ? windowName : activeWindow;
            message = landed ? `Navigate: ${windowName}` : `Navigate failed: ${windowName}`;
          } else {
            ok = false;
            message = `Could not find nav: ${windowName}`;
          }
        }
      } else {
        message = event.action;
      }
    } else if (event.category === "error") {
      message = event.detail?.message ? `Error: ${event.detail.message}` : event.action;
    } else {
      message = event.action;
    }

    const result: replay_step_result = { event, ok, message };
    results.push(result);
    onStep?.(result);
    if (shouldAbort?.()) break;
    await sleep(speedMs);
  }

  if (clearHighlight) clearHighlight();
  onComplete?.();
  return results;
}

export function filterReplayableEvents(events: activity_event_row[]): activity_event_row[] {
  return events.filter((e) =>
    ["ui_click", "ui_input", "ui_navigate", "error"].includes(e.category),
  );
}
