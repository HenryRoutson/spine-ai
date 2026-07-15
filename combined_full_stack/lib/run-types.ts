// AI : client-safe run progress / job DTOs — no server imports (fs, Supabase, etc.).
import type {
  ModuleId,
  ModuleKind,
  PipelineRun,
  RunId,
  RunStepStatus,
  StepDescriptionFields,
} from "./types";
import type { ParsedCustomCodeEntry } from "@/lib/custom_code_entries";
import type { FeedbackInputMode } from "@/lib/feedback-types";

// AI : spec vision — accumulated step outputs keyed by module.label (see lib/server/pipeline_state.ts TODO).
export type StepLabel = string;
export type PipelineState = Record<StepLabel, unknown>;

export enum JobLogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
}

export interface JobLogEntry {
  at: number;
  level: JobLogLevel;
  tag: string;
  line: string;
  moduleId?: ModuleId; // AI : pipeline step that emitted this line — powers per-step log panels
}

export interface StepSubProgress {
  label: string;
  current: number;
  total: number;
}

export interface StepProgress extends StepDescriptionFields {
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
  code?: string;
  entries?: ParsedCustomCodeEntry[];
  input: unknown;
  pipelineState?: PipelineState;
  expectedOutputs?: Record<string, unknown>;
  feedbackMode?: FeedbackInputMode;
  feedbackPrompt?: string;
  requireFeedback?: boolean;
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
