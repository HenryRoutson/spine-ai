// AI : client-safe diagnosis stream event names — keep in sync with server diagnosis_assistant.

export const DIAGNOSIS_STREAM_EVENT = {
  DELTA: "delta",
  DONE: "done",
  ERROR: "error",
} as const;
