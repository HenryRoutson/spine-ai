// AI : landing demo — ephemeral store + run built pipeline on example docs right after the agent.

import { buildDefaultInputDocs } from "@/lib/inference-input";
import { orderedInputModules, inputMinCountForModule, moduleInputReady } from "@/lib/inference-input-core";
import { inputDocsByModuleFromAssignment } from "@/lib/inference-input-assignment";
import {
  formatCustomCodeFailureLog,
  runAssertWithFallbacks,
  runCustomCodeWithFallbacks,
} from "@/lib/custom_code";
import { LANDING_DEMO_MODEL } from "@/lib/landing_demo_config";
import { runToHtml } from "@/lib/server/logging";
import { runPipeline, resumeRunPipeline } from "@/lib/server/run_engine";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { hashContent, type Store } from "@/lib/server/store";
import { buildLandingRunDiagnostic, type LandingRunDiagnostic } from "@/lib/server/landing_run_diagnostic";
import { CustomCodeLanguage, RunStatus, type RunId, type PipelineRun } from "@/lib/server/types";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  Project,
  ProjectId,
  RunFingerprint,
  RunTestReport,
} from "@/lib/server/types";
import { DocLabel as DocLabelEnum, InputType as InputTypeEnum } from "@/lib/server/types";
import type { ProjectAssistantDocSpec } from "@/lib/server/pipeline_assistant";
import type {
  FileContentHash,
  ParserCacheRow,
  ParserKind,
  VisionCacheKey,
  VisionCacheRow,
} from "@/lib/server/doc_text_cache";
import type { JobLogEntry } from "@/lib/run-types";
import { JobLogLevel } from "@/lib/run-types";
import type {
  LandingPipelineModuleTrace,
  LandingRunStepTrace,
  LandingRunTrace as LandingRunTraceWire,
} from "@shared/landing-demo/stream";

export type LandingExampleDoc = { ref: DocRef; content: string };

export type { LandingPipelineModuleTrace, LandingRunStepTrace };

// AI : server run trace — shared wire shape + branded ids / diagnostic fields for persistence.
export type LandingRunTrace = LandingRunTraceWire & {
  runId: RunId;
  status: PipelineRun["status"];
  savedCents: number;
  model: string;
  steps: LandingRunStepTrace[];
  modules: LandingPipelineModuleTrace[];
  // AI : kept for downloads/debug; landing UI renders structured steps instead of the HTML iframe.
  traceHtml: string;
  // AI : structured twin of error — persisted to landing_page_calls.diagnostic_json.
  diagnosticJson?: LandingRunDiagnostic["json"];
  diagnosticSummary?: string;
};

function stepsForLanding(run: PipelineRun): LandingRunStepTrace[] {
  return run.steps.map((s) => ({
    moduleId: s.moduleId,
    kind: s.kind,
    label: s.label,
    model: s.model,
    status: s.status,
    ms: s.ms,
    costCents: s.costCents,
    savedCostCents: s.savedCostCents,
    inputPreview: s.inputPreview,
    outputPreview: s.outputPreview,
    outputJson: s.outputJson,
  }));
}

function modulesForLanding(modules: Project["modules"]): LandingPipelineModuleTrace[] {
  return modules.map((m) => ({
    id: m.id,
    kind: m.kind,
    label: m.label,
    note: m.note,
    model: m.model,
    prompt: m.prompt,
  }));
}

// AI : landing has no browser — run TS custom-code/assert on the server (trusted demo agent output only).
const LANDING_CLIENT_RESUME_MAX = 8;

async function resolveLandingClientStep(
  checkpoint: import("@/lib/server/run_checkpoint").RunCheckpoint,
): Promise<{ output?: unknown; error?: string; clientLogs?: JobLogEntry[] }> {
  const step = checkpoint.clientStep;
  if (step.kind === "human-review") {
    // AI : landing demo has no operator — auto-approve passthrough.
    return { output: step.input };
  }
  const entries = step.entries ?? [];
  if (!entries.length) {
    return { error: `${step.kind} step "${step.label}" has no code configured` };
  }
  if (entries.some((e) => e.language === CustomCodeLanguage.Python)) {
    return {
      error: `landing demo cannot run Python custom-code on the server (step "${step.label}") — use TypeScript`,
    };
  }
  const clientLogs: JobLogEntry[] = [];
  const tag = step.kind === "assert" ? "assert" : "custom-code";
  const codeOpts = { maxRunMs: step.maxRunMs }
  try {
    const { output, failures, attemptIndex, language } =
      step.kind === "assert"
        ? await runAssertWithFallbacks(entries, step.input, step.pipelineState, step.expectedOutputs, codeOpts)
        : await runCustomCodeWithFallbacks(entries, step.input, step.pipelineState, codeOpts);
    for (const f of failures) {
      clientLogs.push({
        at: Date.now(),
        level: JobLogLevel.Warn,
        tag,
        line: formatCustomCodeFailureLog(f, tag),
        moduleId: step.moduleId,
      });
    }
    if (failures.length) {
      clientLogs.push({
        at: Date.now(),
        level: JobLogLevel.Info,
        tag,
        line: `${tag} succeeded on attempt ${attemptIndex + 1} (${language}) after ${failures.length} fallback(s)`,
        moduleId: step.moduleId,
      });
    }
    return { output, clientLogs };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), clientLogs };
  }
}

function traceFromRun(
  run: PipelineRun,
  exampleDocs: LandingExampleDoc[],
  modules: Project["modules"],
  diagnostic?: LandingRunDiagnostic,
): LandingRunTrace {
  return {
    runId: run.id,
    status: run.status,
    totalMs: run.totalMs,
    billedCents: run.billedCents,
    savedCents: run.savedCents,
    model: run.model,
    exampleDocNames: exampleDocs.map((d) => d.ref.name),
    steps: stepsForLanding(run),
    modules: modulesForLanding(modules),
    traceHtml: runToHtml(run),
    error: diagnostic?.text,
    diagnosticJson: diagnostic?.json,
    diagnosticSummary: diagnostic?.summary,
  };
}

function failedTrace(
  err: unknown,
  project: Project,
  exampleDocs: LandingExampleDoc[],
  primary: DocId,
  extras?: {
    run?: PipelineRun | null;
    pause?: LandingRunDiagnostic["json"]["pause"];
    title?: string;
  },
): LandingRunTrace {
  const diagnostic = buildLandingRunDiagnostic({
    err,
    project,
    exampleDocs,
    run: extras?.run,
    pause: extras?.pause,
    title: extras?.title,
  });
  const shortMessage = err instanceof Error ? err.message : "Pipeline run failed";
  const failed: PipelineRun = extras?.run ?? {
    id: "run_land_failed" as RunId,
    startedAt: Date.now(),
    status: RunStatus.Error,
    totalMs: 0,
    billedCents: 0,
    savedCents: 0,
    model: LANDING_DEMO_MODEL,
    steps: [],
    inputDocId: primary,
    notes: shortMessage,
  };
  return traceFromRun(
    { ...failed, status: RunStatus.Error, notes: shortMessage },
    exampleDocs,
    project.modules,
    diagnostic,
  );
}

function textStandInForBinary(type: InputType, label: string, taskHint: string): string {
  const hint = taskHint.trim().slice(0, 200) || "demo automation task";
  return [
    `Example ${label} document (text stand-in for ${type}).`,
    `Task context: ${hint}`,
    "",
    "Sample content:",
    "- Item A — details for the pipeline to process",
    "- Item B — secondary details",
    "- Notes: generated for the landing-page demo run",
  ].join("\n");
}

function fallbackExampleDocs(project: Project, task: string): ProjectAssistantDocSpec[] {
  const inputs = orderedInputModules(project.modules);
  if (!inputs.length) {
    return [
      {
        name: "example_input.txt",
        type: InputTypeEnum.Text,
        content: textStandInForBinary(InputTypeEnum.Text, "Input", task),
        label: DocLabelEnum.Inference,
      },
    ];
  }
  const out: ProjectAssistantDocSpec[] = [];
  for (const m of inputs) {
    const min = inputMinCountForModule(m);
    const types = Array.isArray(m.inputType) ? m.inputType : m.inputType ? [m.inputType] : [InputTypeEnum.Text];
    const preferred =
      types.includes(InputTypeEnum.Text) || types.includes(InputTypeEnum.Json)
        ? (types.includes(InputTypeEnum.Json) ? InputTypeEnum.Json : InputTypeEnum.Text)
        : InputTypeEnum.Text;
    const nameHint = m.inputNameContains?.trim() || m.label.replace(/\s+/g, "_").toLowerCase() || "example";
    for (let i = 0; i < min; i++) {
      const suffix = min > 1 ? `_${i + 1}` : "";
      const ext = preferred === InputTypeEnum.Json ? "json" : "txt";
      const name = `${nameHint}${suffix}.${ext}`;
      const content =
        preferred === InputTypeEnum.Json
          ? JSON.stringify(
              {
                title: `Example ${m.label}${suffix}`,
                task: task.slice(0, 120),
                notes: ["sample field one", "sample field two"],
              },
              null,
              2,
            )
          : textStandInForBinary(types[0] ?? InputTypeEnum.Text, m.label, task);
      out.push({ name, type: preferred, content, label: DocLabelEnum.Inference });
    }
  }
  return out;
}

export function materializeLandingExampleDocs(
  project: Project,
  agentDocs: ProjectAssistantDocSpec[],
  task: string,
): LandingExampleDoc[] {
  const specs = agentDocs.length ? agentDocs : fallbackExampleDocs(project, task);
  const out: LandingExampleDoc[] = [];
  for (const spec of specs) {
    const type = (spec.type as InputType) || InputTypeEnum.Text;
    const label = (spec.label as DocLabel) || DocLabelEnum.Inference;
    const content = spec.content;
    const id = hashContent(`landing:${project.id}:${spec.name}:${content}`);
    const ref: DocRef = {
      id,
      name: spec.name,
      type,
      label,
      sizeKb: Math.max(1, Math.round(content.length / 1024)),
      uploadedAt: Date.now(),
      preview: content.slice(0, 180),
    };
    out.push({ ref, content });
  }
  return out;
}

// AI : TODO (arch-ephemeral-store) — copy of pipeline_export_parity.ephemeralStore; one ephemeralStore(project, docs).
export function ephemeralPipelineStore(project: Project, docs: LandingExampleDoc[]): Store {
  const docMap = new Map(docs.map((d) => [d.ref.id, d]));
  const runs: PipelineRun[] = [];
  const runProjects: Record<string, ProjectId> = {};

  return {
    projects: () => [project],
    project: (id) => (id === project.id ? project : undefined),
    saveProject: () => {},
    deleteProject: () => false,
    docs: () => docs.map((d) => d.ref),
    docContent: (id) => docMap.get(id)?.content,
    parserCacheGetByFileHash: (_h: FileContentHash, _p: ParserKind) => undefined,
    parserCacheGetByDoc: (_id: DocId) => undefined,
    parserCacheSet: (_row: Omit<ParserCacheRow, "createdAt"> & { createdAt?: number }) => {},
    visionCacheGet: (_key: VisionCacheKey) => undefined,
    visionCacheSet: (_row: Omit<VisionCacheRow, "createdAt"> & { createdAt?: number }) => {},
    visionCachesForDoc: (_id: DocId) => [],
    addDoc: (name, type, content, label) => {
      const id = hashContent(content);
      const ref: DocRef = {
        id,
        name,
        type,
        label,
        sizeKb: Math.max(1, Math.round(content.length / 1024)),
        uploadedAt: Date.now(),
        preview: content.slice(0, 180),
      };
      docMap.set(id, { ref, content });
      return ref;
    },
    repointDocName: () => false,
    removeDoc: () => false,
    runs: (pid) => (pid ? runs.filter((r) => runProjects[r.id] === pid) : runs),
    findRunByFingerprint: (_pid: ProjectId, _fp: RunFingerprint) => undefined,
    addRun: (pid, run) => {
      runProjects[run.id] = pid;
      runs.unshift(run);
    },
    updateRunNotes: () => false,
    updateRunTest: (_rid: RunId, _test: RunTestReport | undefined) => false,
    flush: async () => {},
  };
}

export async function runLandingPipelineWithExamples(
  project: Project,
  exampleDocs: LandingExampleDoc[],
): Promise<LandingRunTrace> {
  // AI : example files are text/json stand-ins — widen binary-only input slots so the run can proceed.
  const runProject: Project = {
    ...project,
    modules: project.modules.map((m) => {
      if (m.kind !== "input") return m;
      const types = Array.isArray(m.inputType) ? m.inputType : m.inputType ? [m.inputType] : [];
      if (types.includes(InputTypeEnum.Text) || types.includes(InputTypeEnum.Json)) return m;
      return { ...m, inputType: [...types, InputTypeEnum.Text] };
    }),
  };
  const store = ephemeralPipelineStore(runProject, exampleDocs);
  const inputMods = orderedInputModules(runProject.modules);
  const assignment = buildDefaultInputDocs(
    exampleDocs.map((d) => d.ref),
    runProject,
    inputMods,
  );

  for (const m of inputMods) {
    if (!moduleInputReady(m, assignment)) {
      throw new Error(
        `Could not assign example files to input "${m.label}" (need ${inputMinCountForModule(m)}).`,
      );
    }
  }

  const byModule = inputDocsByModuleFromAssignment(inputMods, assignment);
  const primary =
    (Object.values(byModule).flat()[0] as DocId | undefined) ?? exampleDocs[0]?.ref.id;
  if (!primary) throw new Error("No example documents available to run the pipeline.");

  try {
    // AI : landing has no browser pause loop — auto-resume custom-code/assert on the server.
    let run: PipelineRun | undefined;
    let resumes = 0;
    try {
      run = await runPipeline(store, runProject.id, primary, {
        model: LANDING_DEMO_MODEL,
        inputDocsByModule: byModule,
        persist: false,
        liveHtml: false,
        projectOverride: runProject,
        cacheOwnerId: `landing:${runProject.id}`,
        runMeta: { notes: "landing-demo" },
      });
    } catch (firstErr) {
      let err: unknown = firstErr;
      while (err instanceof PipelinePausedError) {
        if (resumes >= LANDING_CLIENT_RESUME_MAX) {
          return failedTrace(err, runProject, exampleDocs, primary, {
            pause: {
              stepIndex: err.checkpoint.stepIndex,
              moduleId: err.checkpoint.clientStep.moduleId,
              label: err.checkpoint.clientStep.label,
              kind: err.checkpoint.clientStep.kind,
              hasCode: !!(err.checkpoint.clientStep.entries?.length || err.checkpoint.clientStep.code),
            },
            title: "=== Landing pipeline run error (too many client-code pauses) ===",
          });
        }
        resumes += 1;
        const clientStep = await resolveLandingClientStep(err.checkpoint);
        try {
          run = await resumeRunPipeline(store, err.checkpoint, clientStep, {
            model: LANDING_DEMO_MODEL,
            persist: false,
            liveHtml: false,
            projectOverride: runProject,
            cacheOwnerId: `landing:${runProject.id}`,
            clientLogs: clientStep.clientLogs,
            runMeta: { notes: "landing-demo" },
          });
          err = null;
        } catch (resumeErr) {
          err = resumeErr;
        }
      }
      if (err) {
        const pause =
          firstErr instanceof PipelinePausedError
            ? {
                stepIndex: firstErr.checkpoint.stepIndex,
                moduleId: firstErr.checkpoint.clientStep.moduleId,
                label: firstErr.checkpoint.clientStep.label,
                kind: firstErr.checkpoint.clientStep.kind,
                hasCode: !!(
                  firstErr.checkpoint.clientStep.entries?.length || firstErr.checkpoint.clientStep.code
                ),
              }
            : undefined;
        return failedTrace(err, runProject, exampleDocs, primary, { pause });
      }
    }
    if (!run) throw new Error("Landing pipeline produced no run");
    if (run.status === RunStatus.Error) {
      const last = [...run.steps].reverse().find((s) => s.status === "error");
      return failedTrace(
        new Error(last?.outputPreview ?? "Pipeline run finished with errors"),
        runProject,
        exampleDocs,
        primary,
        { run },
      );
    }
    return traceFromRun(run, exampleDocs, runProject.modules);
  } catch (err) {
    return failedTrace(err, runProject, exampleDocs, primary);
  }
}
