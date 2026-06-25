import { AsyncLocalStorage } from "node:async_hooks";
import type { JobLogEntry } from "@/lib/run-types";
import type { ModuleId } from "./types";

export type { JobLogEntry };

type JobLogSink = (entry: JobLogEntry) => void;

let sink: JobLogSink | undefined;
const taps: JobLogSink[] = [];
const stepModule = new AsyncLocalStorage<ModuleId | undefined>();

export function installJobLogSink(s: JobLogSink): void {
  sink = s;
}

function stampModuleId(entry: JobLogEntry): JobLogEntry {
  if (entry.moduleId) return entry;
  const moduleId = stepModule.getStore();
  return moduleId ? { ...entry, moduleId } : entry;
}

export function withStepModuleContext<T>(moduleId: ModuleId | undefined, fn: () => Promise<T>): Promise<T> {
  return stepModule.run(moduleId, fn);
}

export function pushJobLog(entry: JobLogEntry): void {
  const stamped = stampModuleId(entry);
  sink?.(stamped);
  for (const tap of taps) tap(stamped);
}

// AI : run_engine captures per-step logs without replacing the job-level sink.
export async function collectLogsDuring<T>(fn: () => Promise<T>): Promise<{ value: T; logs: JobLogEntry[] }> {
  const logs: JobLogEntry[] = [];
  const tap = (entry: JobLogEntry) => logs.push(entry);
  taps.push(tap);
  try {
    const value = await fn();
    return { value, logs };
  } finally {
    const i = taps.indexOf(tap);
    if (i >= 0) taps.splice(i, 1);
  }
}
