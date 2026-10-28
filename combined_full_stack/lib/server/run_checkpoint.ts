import type { LlmClientStepSpec } from "@/lib/llm-client-step";
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
// AI : TODO (media-view-D-job-park) — optional park/resume if a host kills long polls; in-process poll is the default.
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
    forkId?: ModuleId;
    branchId?: string;
    source?: import("./types").RunSource;
    appSqlScope?: string;
  };
  clientStep: {
    moduleId: ModuleId;
    label: string;
    kind: PipelineModule["kind"];
    code?: string;
    entries?: ParsedCustomCodeEntry[];
    input: unknown;
    pipelineState?: import("../run-types").PipelineState;
    expectedOutputs?: Record<string, unknown>;
    llmClient?: LlmClientStepSpec;
    maxRunMs?: number;
    // AI : chatbot pause — mode/model/maxTurns for Inference panel turns.
    chatbotMode?: import("@/lib/chatbot-step").ChatbotMode;
    model?: ModelId;
    maxTurns?: number;
  };
  expectedOutputs?: Record<string, unknown>;
};

export class HumanReviewPendingError extends Error {
  constructor(readonly input: unknown) {
    super("human review pending");
  }
}

export class ChatbotPendingError extends Error {
  constructor(
    readonly input: unknown,
    readonly chatbotMode: import("@/lib/chatbot-step").ChatbotMode,
    readonly model?: ModelId,
    readonly maxTurns?: number,
  ) {
    super("chatbot session pending");
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

export class LlmClientStepPendingError extends Error {
  constructor(readonly llmClient: LlmClientStepSpec) {
    super("browser LLM provider step pending");
  }
}

export class PipelinePausedError extends Error {
  constructor(readonly checkpoint: RunCheckpoint) {
    super("pipeline paused for client code");
  }
}
