// AI : client-safe run progress / job DTOs — no server imports (fs, Supabase, etc.).
import type { ModuleId, ModuleKind, PipelineRun, RunId, RunStepStatus } from "./types";

export type JobLogLevel = "debug" | "info" | "warn" | "error";

export interface JobLogEntry {
  at: number;
  level: JobLogLevel;
  tag: string;
  line: string;
}

export interface StepSubProgress {
  label: string;
  current: number;
  total: number;
}

export interface StepProgress {
  index: number;
  total: number;
  moduleId: ModuleId;
  label: string;
  status: "running" | RunStepStatus;
  sub?: StepSubProgress;
}

export type RunJobId = string & { __brand: "RunJobId" };

export type ClientStepSpec = {
  moduleId: ModuleId;
  label: string;
  kind: ModuleKind;
  code: string;
  input: unknown;
};

export interface RunJob {
  steps: StepProgress[];
  logs?: JobLogEntry[];
  run?: PipelineRun;
  error?: string;
  deduped?: boolean;
  cachedRunId?: RunId;
  clientStep?: ClientStepSpec;
}
