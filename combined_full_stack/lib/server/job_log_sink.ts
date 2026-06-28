import { AsyncLocalStorage } from "node:async_hooks";
import type { JobLogEntry } from "@/lib/run-types";
import type { ModuleId } from "./types";

export type { JobLogEntry };

type JobLogSink = (entry: JobLogEntry) => void;

let sink: JobLogSink | undefined;
// AI : per-step log capture — must be ALS-scoped so concurrent runs/users don't share a tap array.
const stepLogCollector = new AsyncLocalStorage<JobLogEntry[]>();
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
  stepLogCollector.getStore()?.push(stamped);
}

// AI : run_engine captures per-step logs without replacing the job-level sink.
export async function collectLogsDuring<T>(fn: () => Promise<T>): Promise<{ value: T; logs: JobLogEntry[] }> {
  const logs: JobLogEntry[] = [];
  return stepLogCollector.run(logs, async () => {
    const value = await fn();
    return { value, logs };
  });
}
