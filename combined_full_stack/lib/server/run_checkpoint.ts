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
export type RunCheckpoint = {
  runId: RunId;
  projectId: ProjectId;
  inputDocId: DocId;
  inputDocIds?: DocId[];
  fingerprintInputDocIds?: DocId[]; // AI : full slot list — ctx.inputQueue is depleted after input steps
  model: ModelId;
  stepIndex: number;
  startedAt: number;
  steps: RunStep[];
  ctx: {
    inputQueue: DocId[];
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
    code: string;
    input: unknown;
  };
};

export class ClientStepPendingError extends Error {
  constructor(
    readonly code: string,
    readonly input: unknown,
  ) {
    super("client code step pending");
  }
}

export class PipelinePausedError extends Error {
  constructor(readonly checkpoint: RunCheckpoint) {
    super("pipeline paused for client code");
  }
}
