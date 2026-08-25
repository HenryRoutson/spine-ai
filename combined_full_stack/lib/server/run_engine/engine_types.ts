import type { JobLogEntry, PipelineState, StepProgress, StepSubProgress } from "@/lib/run-types";
import type { ExampleSelectVerdict } from "@/lib/example-select-verdicts";
import type { runLogger } from "../server_logger";
import type { Store } from "../store";
import type { UsageLedger } from "../usage";
import type { RunCheckpoint } from "../run_checkpoint";
import type {
  DocId,
  InputDescriptionCheckResult,
  InputPreviewItem,
  LlmCallRecord,
  ModelId,
  ModuleId,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
  RunFailureRecord,
  RunId,
  RunStep,
  RunStepStatus,
  StructureModel,
  StructureModelId,
} from "../types";

export type { StepProgress, StepSubProgress };

export type RunLogger = ReturnType<typeof runLogger>;

export interface RunOptions {
  model: ModelId;
  inputDocIds?: DocId[];
  inputDocsByModule?: Partial<Record<ModuleId, DocId[]>>;
  fingerprint?: import("../types").RunFingerprint;
  fingerprintInputDocIds?: DocId[];
  cacheOwnerId?: string;
  onStep?: (p: StepProgress) => void | Promise<void>;
  persist?: boolean;
  liveHtml?: boolean;
  projectOverride?: Project;
  runMeta?: Pick<
    PipelineRun,
    "source" | "sharedLinkId" | "hostedApiId" | "scheduleId" | "viewerName" | "viewerSessionId" | "triggerUserId" | "triggerUserEmail" | "notes"
  >;
}

export type ClientStepResume = { output?: unknown; error?: string };

export interface ExecResult {
  value: unknown;
  preview: string;
  json?: string;
  inputPreview?: string;
  inputPreviewItems?: InputPreviewItem[];
  outputPreviewItems?: InputPreviewItem[];
  docId?: DocId;
  llmCalls?: LlmCallRecord[];
  exampleSelectVerdicts?: ExampleSelectVerdict[];
}

export interface RunCtx {
  project: Project;
  store: Store;
  ledger: UsageLedger;
  model: ModelId;
  inputByModule: Map<ModuleId, DocId[]>;
  byLabel: PipelineState;
  byModel: Map<StructureModelId, unknown>;
  outputs: Map<ModuleId, unknown>;
  sourceText: string;
  sourceDocId: DocId;
  prevModuleId?: ModuleId;
  forkId?: ModuleId;
  branchId?: string;
  reportSub?: (sub: StepSubProgress) => void;
  stepLlmCalls?: LlmCallRecord[];
  stepExtraFailures?: RunFailureRecord[];
  // AI : per-llm-step spend cap — set in linear runner before description check / exec.
  stepCostLimitCents?: number;
  stepBaseCents?: number;
  // AI : Settings → Secrets merged over process.env for webhook URL/auth. Never serialize into checkpoints.
  webhookEnv?: Record<string, string>;
  // AI : testing skips live Nango; live runs need connectConnectionId.
  source?: import("../types").RunSource;
}

export type StepInputForCheck = {
  value: unknown;
  vision?: { store: Store; docId: DocId; docName: string };
  items?: import("../input_description_check").InputDescriptionCheckListItem[];
};

export type LinearStepParams = {
  project: Project;
  projectId: ProjectId;
  model: ModelId;
  cacheOwnerId: string;
  ctx: RunCtx;
  steps: RunStep[];
  artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[];
  ledger: UsageLedger;
  log: RunLogger;
  opts: Omit<RunOptions, "model"> & { model?: ModelId };
  writeLive: (runningIndex: number) => void;
  runId: RunId;
  startedAt: number;
  inputDocId: DocId;
  fingerprintInputDocIds: DocId[];
  savedCentsAcc: { value: number };
  modules?: PipelineModule[];
  forkId?: ModuleId;
  branchId?: string;
};

export type StepOutcome = {
  status: RunStepStatus;
  result: ExecResult;
  descriptionCheckCostCents?: number;
  descriptionCheckLlmCalls?: LlmCallRecord[];
  inputDescriptionCheck?: InputDescriptionCheckResult;
  savedCostCents?: number;
};

export type MaterializeHints = {
  docId: DocId;
  label: string;
  note?: string;
  sourceText: string;
};

export type SerializedCtx = RunCheckpoint["ctx"];
