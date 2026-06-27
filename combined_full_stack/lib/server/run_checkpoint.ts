import type { ParsedCustomCodeEntry } from "@/lib/custom_code_entries";
import type {
  DocId,
  ModelId,
  ModuleId,
  PipelineModule,
  PipelineRun,
  ProjectId,
  RunId,
  RunStep,
  StructureModelId,
} from "./types";

// AI : serialized mid-run state — server pauses before user-code steps; browser runs the fn and POSTs back.
// AI : TODO(spec) — checkpoint.ctx gains `byLabel: PipelineState`; clientStep carries it for custom TS.
export type RunCheckpoint = {
  runId: RunId;
  projectId: ProjectId;
  cacheOwnerId?: string;
  inputDocId: DocId;
  inputDocIds?: DocId[];
  fingerprintInputDocIds?: DocId[]; // AI : full slot list — ctx.inputQueue is depleted after input steps
  model: ModelId;
  stepIndex: number;
  startedAt: number;
  steps: RunStep[];
  ctx: {
    inputByModule?: Record<ModuleId, DocId[]>;
    inputQueue?: DocId[]; // AI : legacy checkpoints
    byLabel?: import("../run-types").PipelineState;
    outputs: Record<ModuleId, unknown>;
    byModel: Record<StructureModelId, unknown>;
    sourceText: string;
    sourceDocId: DocId;
    prevModuleId?: ModuleId;
  };
  clientStep: {
    moduleId: ModuleId;
    label: string;
    kind: PipelineModule["kind"];
    code?: string;
    entries?: ParsedCustomCodeEntry[];
    input: unknown;
    pipelineState?: import("../run-types").PipelineState;
  };
};

export class HumanReviewPendingError extends Error {
  constructor(readonly input: unknown) {
    super("human review pending");
  }
}

export class ClientStepPendingError extends Error {
  constructor(
    readonly entries: ParsedCustomCodeEntry[],
    readonly input: unknown,
    readonly pipelineState?: import("../run-types").PipelineState,
  ) {
    super("client code step pending");
  }
}

export class PipelinePausedError extends Error {
  constructor(readonly checkpoint: RunCheckpoint) {
    super("pipeline paused for client code");
  }
}
