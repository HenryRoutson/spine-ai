import type { JobLogEntry } from "@/lib/run-types";

export type { JobLogEntry };

type JobLogSink = (entry: JobLogEntry) => void;

let sink: JobLogSink | undefined;

export function installJobLogSink(s: JobLogSink): void {
  sink = s;
}

export function pushJobLog(entry: JobLogEntry): void {
  sink?.(entry);
}
