// AI : client-safe run progress / job DTOs — no server imports (fs, Supabase, etc.).
import type { ModuleId, ModuleKind, PipelineRun, RunId, RunStepStatus } from "./types";

// AI : spec vision — accumulated step outputs keyed by module.label (see lib/server/pipeline_state.ts TODO).
export type StepLabel = string;
export type PipelineState = Record<StepLabel, unknown>;

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
  // AI : TODO(spec) — full label-keyed state for custom TS: `(input, state) => output`.
  pipelineState?: PipelineState;
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
