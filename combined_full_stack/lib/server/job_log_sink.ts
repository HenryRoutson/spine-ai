import type { LogLevel } from "./server_logger";

// AI : decouples ServerLogger from run_jobs — avoids circular imports; run_jobs installs the sink.
export interface JobLogEntry {
  at: number;
  level: LogLevel;
  tag: string;
  line: string;
}

type JobLogSink = (entry: JobLogEntry) => void;

let sink: JobLogSink | undefined;

export function installJobLogSink(s: JobLogSink): void {
  sink = s;
}

export function pushJobLog(entry: JobLogEntry): void {
  sink?.(entry);
}
