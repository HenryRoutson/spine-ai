import type { activity_event_row } from "./activity_types";
import type { replay_step_result } from "./activity_replayer";

export const REPLAY_MSG_SOURCE = {
  dashboard: "activity-dashboard",
  app: "activity-app",
} as const;

export type replay_bridge_step_ack = {
  source: typeof REPLAY_MSG_SOURCE.app;
  type: "REPLAY_STEP";
  eventId: string;
  ok: boolean;
  message: string;
};

export type replay_bridge_options = {
  speedMs?: number;
  onStep?: (result: replay_step_result) => void;
  onComplete?: () => void;
  shouldAbort?: () => boolean;
  shouldPause?: () => boolean;
};

const DEFAULT_SPEED_MS = 650;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitReplayDelay(
  ms: number,
  shouldAbort?: () => boolean,
  shouldPause?: () => boolean,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (shouldAbort?.()) return false;
    while (shouldPause?.()) {
      if (shouldAbort?.()) return false;
      await sleep(50);
    }
    await sleep(50);
  }
  return true;
}

async function waitWhilePaused(
  shouldAbort?: () => boolean,
  shouldPause?: () => boolean,
): Promise<boolean> {
  while (shouldPause?.()) {
    if (shouldAbort?.()) return false;
    await sleep(50);
  }
  return true;
}

// AI : wait for replay-mode app to mount and signal readiness via postMessage.
export function waitForReplayAppReady(
  iframe: HTMLIFrameElement,
  timeoutMs = 8_000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.source === REPLAY_MSG_SOURCE.app && ev.data?.type === "REPLAY_READY") {
        cleanup();
        resolve(true);
      }
    };
    const timer = window.setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        cleanup();
        resolve(false);
      }
    }, 100);
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
    window.addEventListener("message", onMessage);
  });
}

function waitForReplayStepAck(
  eventId: string,
  timeoutMs = 3_000,
): Promise<replay_bridge_step_ack | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as replay_bridge_step_ack | undefined;
      if (data?.source === REPLAY_MSG_SOURCE.app && data.type === "REPLAY_STEP" && data.eventId === eventId) {
        cleanup();
        resolve(data);
      }
    };
    const timer = window.setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        cleanup();
        resolve(null);
      }
    }, 50);
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
    window.addEventListener("message", onMessage);
  });
}

// AI : drive replay through postMessage so React state updates match recorded timeline.
export async function replayActivityEventsViaPostMessage(
  iframe: HTMLIFrameElement,
  events: activity_event_row[],
  options: replay_bridge_options = {},
): Promise<replay_step_result[]> {
  const { speedMs = DEFAULT_SPEED_MS, onStep, onComplete, shouldAbort, shouldPause } = options;
  const win = iframe.contentWindow;
  if (!win) return [];

  const chronological = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const results: replay_step_result[] = [];

  win.postMessage({ source: REPLAY_MSG_SOURCE.dashboard, type: "REPLAY_RESET" }, "*");
  await sleep(120);

  for (const event of chronological) {
    if (shouldAbort?.()) break;
    if (!(await waitWhilePaused(shouldAbort, shouldPause))) break;

    win.postMessage(
      { source: REPLAY_MSG_SOURCE.dashboard, type: "REPLAY_EVENT", event },
      "*",
    );

    const ack = await waitForReplayStepAck(event.id);
    const result: replay_step_result = {
      event,
      ok: ack?.ok ?? false,
      message: ack?.message ?? "Replay step timed out",
    };
    results.push(result);
    onStep?.(result);

    if (shouldAbort?.()) break;
    if (!(await waitReplayDelay(speedMs, shouldAbort, shouldPause))) break;
  }

  onComplete?.();
  return results;
}
