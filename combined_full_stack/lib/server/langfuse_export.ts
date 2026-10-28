// AI : optional secondary telemetry sink — Spine Logging stays canonical; Langfuse is opt-in per project.
import { randomBytes } from "node:crypto";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { createTraceId, startObservation, type LangfuseChain } from "@langfuse/tracing";
import { LlmCallStatus, type LlmCallRecord, type PipelineRun, type Project, type ProjectId, type RunId, type RunStep } from "./types";

const TRACE_PREVIEW_CHARS = 24_000;

type LangfuseCredentials = {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
};

type ActiveLangfuseRun = {
  traceId: string;
  root: LangfuseChain;
};

let spanProcessor: LangfuseSpanProcessor | null = null;
let sdk: NodeSDK | null = null;
let sdkInitAttempted = false;
let activeRun: ActiveLangfuseRun | null = null;

function langfuseCredentials(): LangfuseCredentials | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) return null;
  const baseUrl =
    process.env.LANGFUSE_BASE_URL?.trim() ||
    process.env.LANGFUSE_BASEURL?.trim() ||
    "https://cloud.langfuse.com";
  return { publicKey, secretKey, baseUrl };
}

export function langfuseServerConfigured(): boolean {
  return langfuseCredentials() != null;
}

export function shouldExportProjectToLangfuse(project: Project): boolean {
  return !!project.langfuseExport && langfuseServerConfigured();
}

export function langfuseTraceUrl(traceId: string): string | undefined {
  const creds = langfuseCredentials();
  if (!creds || !traceId) return undefined;
  const base = creds.baseUrl.replace(/\/$/, "");
  return `${base}/trace/${traceId}`;
}

function ensureSdk(): boolean {
  if (sdkInitAttempted) return spanProcessor != null;
  sdkInitAttempted = true;
  const creds = langfuseCredentials();
  if (!creds) return false;
  try {
    spanProcessor = new LangfuseSpanProcessor({
      publicKey: creds.publicKey,
      secretKey: creds.secretKey,
      baseUrl: creds.baseUrl,
      environment: process.env.LANGFUSE_TRACING_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development",
    });
    sdk = new NodeSDK({ spanProcessors: [spanProcessor] });
    sdk.start();
    return true;
  } catch {
    spanProcessor = null;
    sdk = null;
    return false;
  }
}

function newSpanId(): string {
  return randomBytes(8).toString("hex");
}

function clipPreview(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= TRACE_PREVIEW_CHARS) return value;
  return `${value.slice(0, TRACE_PREVIEW_CHARS)}\n… [truncated for Langfuse export]`;
}

function llmLevel(status: LlmCallStatus): "DEFAULT" | "ERROR" {
  return status === LlmCallStatus.Ok ? "DEFAULT" : "ERROR";
}

function exportLlmCalls(
  parent: LangfuseChain,
  calls: LlmCallRecord[] | undefined,
  inputPreview: string | undefined,
  model: string | undefined,
  prefix: string,
): void {
  if (!calls?.length) return;
  for (const call of calls) {
    const gen = parent.startObservation(
      `${prefix}${call.promptIndex ?? 0}${call.round != null ? `:r${call.round}` : ""}`,
      {
        input: clipPreview(inputPreview),
        model,
        level: llmLevel(call.status),
        statusMessage: call.failureDetail,
        usageDetails: {
          input: call.inputChars,
          output: call.outputChars,
        },
        metadata: {
          latencyMs: call.latencyMs,
          attempt: call.attempt,
          round: call.round,
          httpStatus: call.httpStatus,
          failureKind: call.failureKind,
        },
      },
      { asType: "generation" },
    );
    gen.end();
  }
}

function exportStepObservation(step: RunStep): void {
  if (!activeRun) return;
  const stepSpan = activeRun.root.startObservation(
    step.label,
    {
      input: clipPreview(step.inputPreview),
      output: clipPreview(step.outputJson ?? step.outputPreview),
      level: step.status === "error" ? "ERROR" : "DEFAULT",
      metadata: {
        spineStepKind: step.kind,
        spineStepStatus: step.status,
        costCents: step.costCents,
        savedCostCents: step.savedCostCents,
        latencyMs: step.ms,
        model: step.model,
        exampleSelectVerdicts: step.exampleSelectVerdicts,
        failures: step.failures,
        inputDescriptionCheck: step.inputDescriptionCheck,
      },
    },
    { asType: "span" },
  );
  exportLlmCalls(stepSpan, step.llmCalls, step.inputPreview, step.model, "llm:");
  exportLlmCalls(
    stepSpan,
    step.descriptionCheckLlmCalls,
    step.inputDescription,
    step.model,
    "input-desc:",
  );
  stepSpan.end();
}

async function openLangfuseRun(params: {
  runId: RunId;
  projectId: ProjectId;
  projectName: string;
  inputDocIds: string[];
  resumed?: boolean;
  source?: string;
}): Promise<string | undefined> {
  if (!ensureSdk()) return undefined;
  const traceId = await createTraceId(params.runId);
  const root = startObservation(
    params.resumed ? `pipeline:${params.projectName} (resume)` : `pipeline:${params.projectName}`,
    {
      input: {
        runId: params.runId,
        projectId: params.projectId,
        inputDocIds: params.inputDocIds,
      },
      metadata: {
        spineRunId: params.runId,
        spineProjectId: params.projectId,
        spineProjectName: params.projectName,
        spineSource: params.source,
        spineResumed: !!params.resumed,
      },
    },
    {
      asType: "chain",
      parentSpanContext: {
        traceId,
        spanId: newSpanId(),
        traceFlags: 1,
      },
    },
  );
  activeRun = { traceId, root };
  return traceId;
}

export async function beginLangfusePipelineRun(params: {
  project: Project;
  projectId: ProjectId;
  runId: RunId;
  inputDocIds: string[];
  source?: string;
}): Promise<string | undefined> {
  if (!shouldExportProjectToLangfuse(params.project)) return undefined;
  return openLangfuseRun({
    runId: params.runId,
    projectId: params.projectId,
    projectName: params.project.name,
    inputDocIds: params.inputDocIds,
    source: params.source,
  });
}

export async function resumeLangfusePipelineRun(params: {
  project: Project;
  projectId: ProjectId;
  runId: RunId;
  inputDocIds: string[];
  source?: string;
}): Promise<string | undefined> {
  if (!shouldExportProjectToLangfuse(params.project)) return undefined;
  if (activeRun?.traceId) return activeRun.traceId;
  return openLangfuseRun({
    runId: params.runId,
    projectId: params.projectId,
    projectName: params.project.name,
    inputDocIds: params.inputDocIds,
    resumed: true,
    source: params.source,
  });
}

export function exportLangfuseRunStep(step: RunStep): void {
  if (!activeRun) return;
  try {
    exportStepObservation(step);
  } catch {
    // AI : tracing must never break pipeline execution.
  }
}

export async function finalizeLangfusePipelineRun(run: PipelineRun): Promise<string | undefined> {
  if (!activeRun) return undefined;
  const { traceId, root } = activeRun;
  activeRun = null;
  try {
    root.update({
      output: {
        status: run.status,
        totalMs: run.totalMs,
        billedCents: run.billedCents,
        savedCents: run.savedCents,
        stepCount: run.steps.length,
        test: run.test?.testDocName,
      },
      level: run.status === "ok" ? "DEFAULT" : "ERROR",
      metadata: {
        spineFingerprint: run.fingerprint,
        spineSource: run.source,
      },
    });
    root.end();
    await spanProcessor?.forceFlush();
  } catch {
    // AI : swallow export errors — run result is already persisted locally.
  }
  return traceId;
}
