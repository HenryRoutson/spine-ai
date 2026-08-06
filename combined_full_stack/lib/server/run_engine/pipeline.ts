import { join } from "node:path";
import { invariant } from "@/lib/assert";
import { usesPassthroughStructure } from "@/lib/module-kinds";
import { uid } from "../../id";
import { finalizeRunMetrics } from "../../run-metrics";
import {
  docMatchesInputModule,
  flattenInputDocIdsFromByModule,
  inputDocsByModuleFromFlat,
  inputMinCountForModule,
  orderedInputModules,
} from "../../inference-input";
import { unknownProject } from "../api-errors";
import { dataDir } from "../config";
import { fileWriteHelper } from "../file_write_helper";
import { collectLogsDuring, withStepModuleContext } from "../job_log_sink";
import { runToHtml } from "../logging";
import { runLogger } from "../server_logger";
import { computeInvalid, formatInvalidMapErrors, migrateProjectModules } from "../validity";
import { withSharedModels } from "../builtin_models";
import {
  DEFAULT_MODEL,
  FailureKind,
  RunStatus,
  RunStepStatus,
  type DocId,
  type ModelId,
  type ModuleId,
  type PipelineRun,
  type ProjectId,
  type RunId,
  type RunStep,
  type StructureModel,
} from "../types";
import type { Store } from "../store";
import { UsageLedger } from "../usage";
import type { RunCheckpoint } from "../run_checkpoint";
import { computeRunFingerprint, buildRunInputDocIds, stepCacheKey } from "../run_fingerprint";
import { writeStepCache } from "../step_cache";
import { validateStepOutput } from "../structure";
import { ensureModelOptionsFresh } from "../openrouter_models";
import {
  beginLangfusePipelineRun,
  exportLangfuseRunStep,
  finalizeLangfusePipelineRun,
  langfuseTraceUrl,
  resumeLangfusePipelineRun,
} from "../langfuse_export";
import { modelById, recordStepModel, snapshotForByLabel, stepFailuresFor, stepServerLogs, validatesStepOutputAsList } from "./helpers";
import { persistArtifacts, persistCustomCodeArtifacts } from "./artifacts";
import { restoreCtx } from "./context";
import { createWriteLive } from "./live";
import { runLinearStepsFrom } from "./linear";
import { buildAssertResult, buildClientResult, buildHumanReviewResult, buildLlmClientResult, failedStepResult } from "./results";
import type { ClientStepResume, RunCtx, RunOptions } from "./engine_types";

export async function runPipeline(
  store: Store,
  projectId: ProjectId,
  inputDocId: DocId,
  opts: Omit<RunOptions, "model"> & { model?: ModelId } = {},
): Promise<PipelineRun> {
  const rawProject = opts.projectOverride ?? store.project(projectId);
  if (!rawProject) throw new Error(unknownProject(projectId));
  const project = migrateProjectModules(rawProject);
  invariant(project.modules.length > 0, `project ${projectId} has no pipeline modules`);
  await ensureModelOptionsFresh();
  const model = opts.model ?? project.modules.find((m) => m.kind === "llm")?.model ?? DEFAULT_MODEL;
  const persist = opts.persist ?? true;

  const ledger = new UsageLedger();
  const runId = uid<RunId>("run_");
  const log = runLogger(runId);
  const startedAt = Date.now();

  log.section("pipeline start");
  log.info(`runPipeline invoked`, {
    projectId,
    projectName: project.name,
    inputDocId,
    model,
    persist,
    moduleCount: project.modules.length,
  });

  const invalid = computeInvalid(project.modules, project.models, {
    typeAliases: project.typeAliases ?? [],
  });
  if (invalid.size > 0) {
    const detail = formatInvalidMapErrors(invalid, project.modules, withSharedModels(project.models));
    log.error(`pipeline invalid`, { invalidModules: [...invalid.keys()], detail });
    throw new Error(detail || `pipeline invalid: ${[...invalid.keys()].join(", ")}`);
  }

  const fingerprintInputDocIds =
    opts.fingerprintInputDocIds ??
    buildRunInputDocIds(store, project, inputDocId, opts.inputDocIds, opts.inputDocsByModule);
  const fingerprint =
    opts.fingerprint ?? computeRunFingerprint(project, model, fingerprintInputDocIds);
  const inputMods = orderedInputModules(project.modules);
  const inputByModuleRecord =
    opts.inputDocsByModule ??
    inputDocsByModuleFromFlat(inputMods, fingerprintInputDocIds);
  log.info(`input queue resolved`, {
    fingerprintInputDocIds,
    fingerprint,
    inputDocsByModule: inputByModuleRecord,
  });

  for (const mod of inputMods) {
    const docIds = inputByModuleRecord[mod.id] ?? [];
    const min = inputMinCountForModule(mod);
    if (docIds.length < min) {
      throw new Error(`input "${mod.label}" needs at least ${min} document(s)`);
    }
    for (const docId of docIds) {
      const doc = store.docs().find((d) => d.id === docId);
      if (doc && !docMatchesInputModule(doc, mod)) {
        const req = mod.inputNameContains?.trim();
        throw new Error(
          req
            ? `input "${mod.label}" requires a filename containing "${req}", got "${doc.name}"`
            : `input "${mod.label}" rejected "${doc.name}" (wrong type for this slot)`,
        );
      }
    }
  }

  const ctx: RunCtx = {
    project,
    store,
    ledger,
    model,
    inputByModule: new Map(Object.entries(inputByModuleRecord) as [ModuleId, DocId[]][]),
    byLabel: {},
    byModel: new Map(),
    outputs: new Map(),
    sourceText: "",
    sourceDocId: inputDocId,
  };

  const steps: RunStep[] = [];
  const artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[] = [];
  const cacheOwnerId = opts.cacheOwnerId ?? "local";
  const savedCentsAcc = { value: 0 };

  const langfuseTraceId = await beginLangfusePipelineRun({
    project,
    projectId,
    runId,
    inputDocIds: fingerprintInputDocIds,
    source: opts.runMeta?.source,
  });

  const writeLive = createWriteLive(project, model, steps, opts.liveHtml ?? persist);
  await runLinearStepsFrom(
    {
      project,
      projectId,
      model,
      cacheOwnerId,
      ctx,
      steps,
      artifacts,
      ledger,
      log,
      opts,
      writeLive,
      runId,
      startedAt,
      inputDocId,
      fingerprintInputDocIds,
      savedCentsAcc,
    },
    0,
  );

  const { totalMs, billedCents } = finalizeRunMetrics(steps, startedAt);
  const savedCents = +savedCentsAcc.value.toFixed(4);

  const run: PipelineRun = {
    id: runId,
    startedAt,
    status: steps.some((s) => s.status === "error") ? RunStatus.Error : RunStatus.Ok,
    totalMs,
    billedCents,
    savedCents,
    model,
    steps,
    inputDocId,
    inputDocIds: fingerprintInputDocIds,
    fingerprint,
    ...opts.runMeta,
  };

  const closedTraceId = await finalizeLangfusePipelineRun(run);
  const exportedTraceId = closedTraceId ?? langfuseTraceId;
  if (exportedTraceId) {
    run.langfuseTraceId = exportedTraceId;
    run.langfuseTraceUrl = langfuseTraceUrl(exportedTraceId);
  }

  writeLive(-1);

  log.section("pipeline complete");
  log.info(`run summary`, {
    runId,
    status: run.status,
    totalMs,
    billedCents,
    savedCents,
    stepCount: steps.length,
    usageRecords: ledger.all().length,
  });
  log.json("steps", steps.map((s) => ({ moduleId: s.moduleId, kind: s.kind, status: s.status, ms: s.ms, costCents: s.costCents })));
  log.json("usage ledger", ledger.all());
  log.finish(`Run ${runId} ${run.status} — ${totalMs}ms · billed ${billedCents.toFixed(2)}c · saved ${savedCents.toFixed(2)}c`);

  if (persist) {
    log.info(`persisting artifacts`, { artifactCount: artifacts.length });
    persistArtifacts(runId, inputDocId, store, artifacts, project.modules, project.models);
    for (const m of project.modules) persistCustomCodeArtifacts(runId, m);
    fileWriteHelper(join(dataDir(), "runs", runId), "run_high_level", "html", runToHtml(run));
    store.addRun(projectId, run);
  }
  return run;
}

export async function resumeRunPipeline(
  store: Store,
  checkpoint: RunCheckpoint,
  clientStep: ClientStepResume,
  opts: Omit<RunOptions, "model"> & {
    model?: ModelId;
    clientLogs?: import("@/lib/run-types").JobLogEntry[];
    codeProfile?: import("@/lib/code-exec-ui").StepCodeProfile;
  } = {},
): Promise<PipelineRun> {
  // AI : landing ephemeral store uses projectOverride — same as runPipeline.
  const rawProject = opts.projectOverride ?? store.project(checkpoint.projectId);
  if (!rawProject) throw new Error(unknownProject(checkpoint.projectId));
  const project = migrateProjectModules(rawProject);

  await ensureModelOptionsFresh();
  const model = checkpoint.model;
  const persist = opts.persist ?? true;
  const ledger = new UsageLedger();
  const log = runLogger(checkpoint.runId);
  const fingerprintInputDocIds =
    checkpoint.fingerprintInputDocIds ??
    checkpoint.inputDocIds ??
    flattenInputDocIdsFromByModule(
      orderedInputModules(project.modules),
      checkpoint.ctx.inputByModule ?? {},
    );
  const fingerprint = computeRunFingerprint(project, model, fingerprintInputDocIds);
  const langfuseTraceId = await resumeLangfusePipelineRun({
    project,
    projectId: checkpoint.projectId,
    runId: checkpoint.runId,
    inputDocIds: fingerprintInputDocIds,
    source: opts.runMeta?.source,
  });
  const ctx = restoreCtx(project, store, ledger, model, checkpoint.ctx);
  const steps: RunStep[] = [...checkpoint.steps];
  const artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[] = steps
    .filter((s) => s.status !== "error")
    .flatMap((s) => {
      const value = ctx.outputs.get(s.moduleId);
      if (value === undefined) return [];
      const m = project.modules.find((x) => x.id === s.moduleId);
      const structId = m?.outStructureId ?? (m?.kind === "output" || m?.kind === "assert" || m?.kind === "human-review" ? m.inStructureId : undefined);
      return [{ moduleId: s.moduleId, structure: modelById(project.models, structId), value }];
    });

  const m = project.modules[checkpoint.stepIndex];
  if (!m) throw new Error(`resume: invalid step index ${checkpoint.stepIndex}`);

  const writeLive = createWriteLive(project, model, steps, opts.liveHtml ?? persist);
  const cacheOwnerId = opts.cacheOwnerId ?? checkpoint.cacheOwnerId ?? "local";
  const savedCentsAcc = {
    value: steps.reduce((a, s) => a + (s.savedCostCents ?? 0), 0),
  };

  const t0 = Date.now();
  const beforeCents = ledger.totalCents();
  const defaultInputPreview = modelById(project.models, m.inStructureId)?.name ?? "Any";

  const { logs: serverLogs, value: stepOutcome } = await withStepModuleContext(m.id, () =>
    collectLogsDuring(async () => {
      let status: RunStepStatus = RunStepStatus.Ok;
      let result: import("./engine_types").ExecResult | undefined;

      log.section(`step ${checkpoint.stepIndex + 1}/${project.modules.length}: ${m.label}`);
      log.info(`client step resume`, { moduleId: m.id, kind: m.kind });

      for (const entry of opts.clientLogs ?? []) {
        const level =
          entry.level === "error" && (entry.tag === "assert" || entry.tag === "custom-code") ? "warn" : entry.level;
        log[level === "error" ? "error" : level === "warn" ? "warn" : "info"](entry.line, {
          moduleId: m.id,
          tag: entry.tag,
        });
      }

      try {
        if (clientStep.error) throw new Error(clientStep.error);
        result =
          m.kind === "assert"
            ? buildAssertResult(clientStep.output)
            : m.kind === "human-review"
              ? buildHumanReviewResult(clientStep.output)
              : checkpoint.clientStep.llmClient
                ? buildLlmClientResult(m, project, clientStep.output, checkpoint.clientStep.llmClient)
                : buildClientResult(m, project, ctx, clientStep.output);
        const validationStructId = usesPassthroughStructure(m.kind) ? m.inStructureId : m.outStructureId;
        const out = modelById(project.models, validationStructId);
        if (out) {
          const prev = checkpoint.stepIndex > 0 ? project.modules[checkpoint.stepIndex - 1] : undefined;
          const isList = validatesStepOutputAsList(m, result.value, prev);
          const check = validateStepOutput(result.value, out, project.models, {
            isList,
            rawQuotes: false,
            typeAliases: project.typeAliases ?? [],
          });
          if (!check.ok) {
            const validationError = check.error ?? "unknown validation error";
            ctx.stepExtraFailures = [{ kind: FailureKind.StepOutput, detail: validationError, recovered: false }];
            log.error(`step output schema validation failed`, {
              failureKind: "step_output",
              structure: out.name,
              detail: validationError,
            });
            throw new Error(`output failed ${out.name} validation: ${validationError}`);
          }
        }
      } catch (err) {
        status = RunStepStatus.Error;
        result = failedStepResult(err, m, ctx, result);
        log.warn(`client step failed`, { moduleId: m.id, error: (err as Error).message, failedJson: result.json });
      }

      log.info(`step finished`, {
        moduleId: m.id,
        status,
        ms: Date.now() - t0,
        costCents: +(ledger.totalCents() - beforeCents).toFixed(4),
        preview: result?.preview,
      });
      return { status, result };
    }),
  );

  const { status, result } = stepOutcome;

  const ms = Date.now() - t0;
  const costCents = ledger.totalCents() - beforeCents;
  if (status !== "error" && m.cached && result) {
    const key = stepCacheKey(cacheOwnerId, checkpoint.projectId, m, m.model ?? model, fingerprintInputDocIds, project);
    writeStepCache(
      key,
      {
        value: result.value,
        json: result.json,
        docId: result.docId,
        inputPreview: result.inputPreview,
        inputPreviewItems: result.inputPreviewItems,
        costCents: +costCents.toFixed(4),
      },
      {
        projectId: checkpoint.projectId,
        moduleId: m.id,
        model: m.model ?? model,
        inputDocIds: fingerprintInputDocIds,
      },
    );
  }
  if (status !== "error") {
    ctx.outputs.set(m.id, result.value);
    ctx.byLabel[m.label] = snapshotForByLabel(m, result.value);
    const structId = m.outStructureId ?? (m.kind === "output" || m.kind === "assert" ? m.inStructureId : undefined);
    if (structId) ctx.byModel.set(structId, result.value);
    ctx.prevModuleId = m.id;
    artifacts.push({ moduleId: m.id, structure: modelById(project.models, structId), value: result.value });
  }

  steps.push({
    moduleId: m.id,
    kind: m.kind,
    label: m.label,
    model: recordStepModel(m, model),
    status,
    ms,
    costCents,
    inputPreview: result.inputPreview ?? defaultInputPreview,
    inputPreviewItems: result.inputPreviewItems,
    outputPreview: result.preview,
    outputJson: result.json,
    inputDescription: m.inputDescription?.trim() || undefined,
    llmCalls: result.llmCalls?.length ? result.llmCalls : undefined,
    exampleSelectVerdicts: result.exampleSelectVerdicts?.length
      ? result.exampleSelectVerdicts
      : undefined,
    failures: stepFailuresFor(result, status, ctx.stepExtraFailures),
    serverLogs: stepServerLogs(serverLogs, m.id),
    codeProfile: opts.codeProfile,
  });
  exportLangfuseRunStep(steps[steps.length - 1]!);
  await opts.onStep?.({ index: checkpoint.stepIndex, total: project.modules.length, moduleId: m.id, label: m.label, status });
  if (status === "error") {
    writeLive(-1);
    const run: PipelineRun = {
      id: checkpoint.runId,
      startedAt: checkpoint.startedAt,
      status: RunStatus.Error,
      ...finalizeRunMetrics(steps, checkpoint.startedAt),
      savedCents: 0,
      model,
      steps,
      inputDocId: checkpoint.inputDocId,
      inputDocIds: fingerprintInputDocIds,
      fingerprint,
      ...opts.runMeta,
    };
    const closedTraceId = await finalizeLangfusePipelineRun(run);
    const exportedTraceId = closedTraceId ?? langfuseTraceId;
    if (exportedTraceId) {
      run.langfuseTraceId = exportedTraceId;
      run.langfuseTraceUrl = langfuseTraceUrl(exportedTraceId);
    }
    if (persist) {
      persistArtifacts(checkpoint.runId, checkpoint.inputDocId, store, artifacts, project.modules, project.models);
      store.addRun(checkpoint.projectId, run);
    }
    return run;
  }

  await runLinearStepsFrom(
    {
      project,
      projectId: checkpoint.projectId,
      model,
      cacheOwnerId,
      ctx,
      steps,
      artifacts,
      ledger,
      log,
      opts,
      writeLive,
      runId: checkpoint.runId,
      startedAt: checkpoint.startedAt,
      inputDocId: checkpoint.inputDocId,
      fingerprintInputDocIds,
      savedCentsAcc,
    },
    checkpoint.stepIndex + 1,
  );

  const { totalMs, billedCents } = finalizeRunMetrics(steps, checkpoint.startedAt);
  const savedCents = +savedCentsAcc.value.toFixed(4);

  const run: PipelineRun = {
    id: checkpoint.runId,
    startedAt: checkpoint.startedAt,
    status: steps.some((s) => s.status === "error") ? RunStatus.Error : RunStatus.Ok,
    totalMs,
    billedCents,
    savedCents,
    model,
    steps,
    inputDocId: checkpoint.inputDocId,
    inputDocIds: fingerprintInputDocIds,
    fingerprint,
    ...opts.runMeta,
  };

  const closedTraceId = await finalizeLangfusePipelineRun(run);
  const exportedTraceId = closedTraceId ?? langfuseTraceId;
  if (exportedTraceId) {
    run.langfuseTraceId = exportedTraceId;
    run.langfuseTraceUrl = langfuseTraceUrl(exportedTraceId);
  }

  writeLive(-1);
  if (persist) {
    persistArtifacts(checkpoint.runId, checkpoint.inputDocId, store, artifacts, project.modules, project.models);
    for (const mod of project.modules) persistCustomCodeArtifacts(checkpoint.runId, mod);
    fileWriteHelper(join(dataDir(), "runs", checkpoint.runId), "run_high_level", "html", runToHtml(run));
    store.addRun(checkpoint.projectId, run);
  }
  return run;
}
