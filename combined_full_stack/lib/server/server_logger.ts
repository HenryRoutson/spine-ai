import { JobLogLevel } from "@/lib/run-types";
import { join } from "node:path";
import { dataDir } from "./config";
import { FileLog } from "./file_log";
import { pushJobLog } from "./job_log_sink";

export type LogLevel = JobLogLevel;
type LogCtx = Record<string, unknown>;

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

function previewVal(v: unknown): string {
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 120) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? s.slice(0, 200) + "…" : s;
  } catch {
    return String(v);
  }
}

function formatCtx(ctx?: LogCtx): string {
  if (!ctx || !Object.keys(ctx).length) return "";
  return " | " + Object.entries(ctx).map(([k, v]) => `${k}=${previewVal(v)}`).join(" ");
}

// AI : tagged console + optional FileLog — one logger per subsystem / run.
export class ServerLogger {
  constructor(
    private tag: string,
    private file?: FileLog,
  ) {}

  child(subtag: string): ServerLogger {
    return new ServerLogger(`${this.tag}:${subtag}`, this.file);
  }

  withFile(file: FileLog): ServerLogger {
    return new ServerLogger(this.tag, file);
  }

  private emit(level: LogLevel, msg: string, ctx?: LogCtx): void {
    // AI : PARITY_QUIET / FORGE_LOG_LEVEL=error — keep live parity from flooding the terminal / Cursor UI.
    const min = process.env.PARITY_QUIET === "1" ? JobLogLevel.Error : process.env.FORGE_LOG_LEVEL?.trim();
    if (min === "error" || min === JobLogLevel.Error) {
      if (level !== JobLogLevel.Error) return;
    } else if (min === "warn" || min === JobLogLevel.Warn) {
      if (level === JobLogLevel.Debug || level === JobLogLevel.Info) return;
    }
    const line = `[${ts()}] [${level.toUpperCase()}] [${this.tag}] ${msg}${formatCtx(ctx)}`;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(line);
    // AI : when a run is active (withJobLogging), mirror every line to the polled job for the browser.
    pushJobLog({ at: Date.now(), level, tag: this.tag, line });
    if (this.file) {
      const color =
        level === "error" ? "red" : level === "warn" ? "yellow" : level === "debug" ? "dim" : undefined;
      this.file.line(line, color);
    }
  }

  debug(msg: string, ctx?: LogCtx): void {
    this.emit(JobLogLevel.Debug, msg, ctx);
  }
  info(msg: string, ctx?: LogCtx): void {
    this.emit(JobLogLevel.Info, msg, ctx);
  }
  warn(msg: string, ctx?: LogCtx): void {
    this.emit(JobLogLevel.Warn, msg, ctx);
  }
  error(msg: string, ctx?: LogCtx): void {
    this.emit(JobLogLevel.Error, msg, ctx);
  }

  section(title: string): void {
    this.info(`── ${title} ──`);
    this.file?.section(title);
  }

  json(label: string, value: unknown): void {
    this.info(label);
    if (this.file) this.file.json(label, value);
    else console.log(JSON.stringify(value, null, 2));
  }

  finish(summary?: string): void {
    if (summary) this.info(summary);
    this.file?.finish(summary);
  }
}

export function logger(tag: string): ServerLogger {
  return new ServerLogger(tag);
}

// AI : per-run file log at data/logs/runs/<runId>.log (tail -f friendly).
export function runLogger(runId: string): ServerLogger {
  const file = new FileLog(join(dataDir(), "logs", "runs"), runId);
  return new ServerLogger(`run:${runId}`, file);
}
