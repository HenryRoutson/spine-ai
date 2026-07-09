// AI : NDJSON event types for the public landing build-pipeline stream.

export const LANDING_DEMO_STREAM_EVENT = {
  THINKING_DELTA: "thinking_delta",
  THINKING_DONE: "thinking_done",
  MESSAGE_DELTA: "message_delta",
  PHASE: "phase",
  DONE: "done",
  ERROR: "error",
} as const;

export type landing_demo_stream_phase =
  | "thinking"
  | "structuring"
  | "retrying"
  | "running";

export type LandingDemoStreamEvent =
  | { type: typeof LANDING_DEMO_STREAM_EVENT.THINKING_DELTA; text: string }
  | { type: typeof LANDING_DEMO_STREAM_EVENT.THINKING_DONE; text: string }
  | { type: typeof LANDING_DEMO_STREAM_EVENT.MESSAGE_DELTA; text: string }
  | { type: typeof LANDING_DEMO_STREAM_EVENT.PHASE; phase: landing_demo_stream_phase }
  | { type: typeof LANDING_DEMO_STREAM_EVENT.DONE; result: unknown }
  | { type: typeof LANDING_DEMO_STREAM_EVENT.ERROR; error: string; code?: string };
