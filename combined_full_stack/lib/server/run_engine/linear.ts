import { invariant } from "@/lib/assert";
import { isLlmKind, usesPassthroughStructure } from "@/lib/module-kinds";
import { compactPreview } from "@/lib/text-preview";
import { labelAsStateKey } from "../pipeline_state";
import { inputTypeLabel } from "../../inference-input";
import { assertInputMatchesDescription, InputDescriptionRejectedError, shouldCheckInputDescription } from "../input_description_check";
import { collectLogsDuring, withStepModuleContext } from "../job_log_sink";
import { ClientStepPendingError, HumanReviewPendingError, ChatbotPendingError, LlmClientStepPendingError, PipelinePausedError } from "../run_checkpoint";
import { expectedOutputsForRun } from "../seed";
import { stepCacheKey } from "../run_fingerprint";
import { readStepCache, writeStepCache } from "../step_cache";
import { hasQuoteField, validateStepOutput } from "../structure";
import { llmStepCostLimitCents, StepCostLimitExceededError } from "../step_cost_limit";
import { customCodeMaxRunMs } from "@/lib/custom-code-max-run";
import { DEFAULT_INPUT_CHECK_MODEL, FailureKind, inputUsesVisionOcr, ModuleKind, RunStepStatus, type LlmCallRecord } from "../types";
import { serializeCtx, resolveStepInputForCheck } from "./context";
import { execModule } from "./exec_module";
import {
  applyModuleSideEffects,
  modelById,
  recordStepModel,
  stepFailuresFor,
  stepServerLogs,
  snapshotForByLabel,
  validatesStepOutputAsList,
} from "./helpers";
import { applyInputCacheSideEffects, failedStepResult, jsonStringifyStepValue, resultFromCache } from "./results";
import { exportLangfuseRunStep } from "../langfuse_export";
import type { ExecResult, LinearStepParams } from "./engine_types";

export async function runLinearStepsFrom(
  params: LinearStepParams,
  startIndex: number,
): Promise<"ok" | "error" | "paused"> {
  const { project, projectId, model, cacheOwnerId, ctx, steps, artifacts, ledger, log, opts, writeLive, runId, startedAt, inputDocId, fingerprintInputDocIds, savedCentsAcc } =
    params;

  // AI : golden picked per run — a preset matching these input docs overrides the project default,
  // AI : so assert steps pass on alternate pre-selected runs (1st grade / university examples).
  const runGolden = () =>
    expectedOutputsForRun(
      project,
      fingerprintInputDocIds.flatMap((id) => {
        const name = ctx.store.docs().find((d) => d.id === id)?.name;
        return name ? [name] : [];
      }),
    );

  for (let i = startIndex; i < project.modules.length; i++) {
    const m = project.modules[i];
    invariant(m, `pipeline module missing at index ${i}`);
    await opts.onStep?.({ index: i, total: project.modules.length, moduleId: m.id, label: m.label, status: "running" });
    writeLive(i);

    ctx.reportSub = (sub) => {
      void opts.onStep?.({
        index: i,
        total: project.modules.length,
        moduleId: m.id,
        label: m.label,
        status: "running",
        sub,
      });
    };
    ctx.stepLlmCalls = undefined;
    ctx.stepExtraFailures = undefined;
    const llmStep = isLlmKind(m.kind) || m.kind === ModuleKind.Parallel;
    ctx.stepCostLimitCents = llmStep ? llmStepCostLimitCents(m) : undefined;
    ctx.stepBaseCents = llmStep ? ledger.totalCents() : undefined;

    const defaultInputPreview =
      i === 0 ? `${inputTypeLabel(m.inputType)} document` : modelById(project.models, m.inStructureId)?.name ?? "Any";
    const beforeCents = ctx.stepBaseCents ?? ledger.totalCents();
    const t0 = Date.now();

    const { logs: serverLogs, value: stepOutcome } = await withStepModuleContext(m.id, () =>
      collectLogsDuring(async () => {
        let status: RunStepStatus = RunStepStatus.Ok;
        let result: ExecResult | undefined;

        log.section(`step ${i + 1}/${project.modules.length}: ${m.label}`);
        log.info(`step starting`, { moduleId: m.id, kind: m.kind, cached: !!m.cached, stepModel: m.model ?? model });

        const key = stepCacheKey(cacheOwnerId, projectId, m, m.model ?? model, fingerprintInputDocIds, project);
        log.debug(`cache lookup`, { key, cachedFlag: !!m.cached });
        const cached = m.cached ? readStepCache(key) : undefined;

        let descriptionCheckCostCents = 0;
        let descriptionCheckLlmCalls: LlmCallRecord[] | undefined;
        let inputDescriptionCheck: import("../types").InputDescriptionCheckResult | undefined;
        let savedCostCents = 0;
        try {
          if (!cached) {
            const inDesc = m.inputDescription?.trim();
            if (inDesc && shouldCheckInputDescription(m)) {
              const descBeforeCents = ledger.totalCents();
              ctx.stepLlmCalls = [];
              try {
                const { value, vision, items } = resolveStepInputForCheck(m, ctx, ctx.store);
                inputDescriptionCheck = await assertInputMatchesDescription(
                  m.label,
                  inDesc,
                  value,
                  {
                    model: DEFAULT_INPUT_CHECK_MODEL,
                    ledger,
                    llmCalls: ctx.stepLlmCalls,
                    costLimitCents: ctx.stepCostLimitCents,
                    stepBaseCents: beforeCents,
                    stepLabel: m.label,
                  },
                  log.child("input-desc"),
                  vision,
                  items,
                );
              } finally {
                if (ctx.stepLlmCalls.length) {
                  descriptionCheckLlmCalls = [...ctx.stepLlmCalls];
                  ctx.stepLlmCalls = [];
                }
              }
              descriptionCheckCostCents = +(ledger.totalCents() - descBeforeCents).toFixed(4);
              await opts.onStep?.({
                index: i,
                total: project.modules.length,
                moduleId: m.id,
                label: m.label,
                status: "running",
                inputDescriptionCheck,
                descriptionCheckLlmCalls,
                descriptionCheckCostCents: descriptionCheckCostCents > 0 ? descriptionCheckCostCents : undefined,
              });
            }
          }
          if (cached) {
            applyModuleSideEffects(m, ctx, ctx.store, log);
            if (m.kind === "input" && inputUsesVisionOcr(m)) {
              applyInputCacheSideEffects(m, cached, ctx);
            }
            status = RunStepStatus.Cached;
            savedCostCents = cached.costCents ?? 0;
            savedCentsAcc.value += savedCostCents;
            result = resultFromCache(m, cached, ctx);
            log.info(`cache HIT`, { moduleId: m.id, key, savedCents: savedCostCents });
          } else {
            result = await execModule(m, ctx, log);
            // AI : passthrough steps (output/assert/human-review) are validated against inStructureId,
            // not outStructureId — outStructureId on those kinds is display-only and may be stale.
            const validationStructId = usesPassthroughStructure(m.kind) ? m.inStructureId : m.outStructureId;
            const out = modelById(project.models, validationStructId);
            if (out) {
              const prev = i > 0 ? project.modules[i - 1] : undefined;
              const isList = validatesStepOutputAsList(m, result.value, prev);
              const rawQuotes = isLlmKind(m.kind) && hasQuoteField(out, project.models);
              // AI : TODO (linter-first) — replace zod validateStepOutput with pydantic parse from generated models.py.
              const check = validateStepOutput(result.value, out, project.models, {
                isList,
                rawQuotes,
                typeAliases: project.typeAliases ?? [],
              });
              if (!check.ok) {
                const failedJson = result.json ?? JSON.stringify(result.value, null, 2);
                const validationError = check.error ?? "unknown validation error";
                ctx.stepExtraFailures = [
                  { kind: FailureKind.StepOutput, detail: validationError, recovered: false },
                ];
                log.error(`step output schema validation failed`, {
                  failureKind: "step_output",
                  structure: out.name,
                  detail: validationError,
                  failedJsonPreview: compactPreview(failedJson, 500),
                });
                throw new Error(`output failed ${out.name} validation: ${validationError}`);
              }
              const itemCount = isList && Array.isArray(result.value) ? result.value.length : 1;
              log.debug(`validation ok`, { moduleId: m.id, structure: out.name, itemCount });
            }
            if (m.cached) {
              const stepCost = +(ledger.totalCents() - beforeCents).toFixed(4);
              writeStepCache(
                key,
                {
                  value: result.value,
                  json:
                    result.json ??
                    (result.value != null ? jsonStringifyStepValue(result.value) : undefined),
                  docId: result.docId,
                  inputPreview: result.inputPreview,
                  inputPreviewItems: result.inputPreviewItems,
                  costCents: stepCost,
                },
                {
                  projectId,
                  moduleId: m.id,
                  model: m.model ?? model,
                  inputDocIds: fingerprintInputDocIds,
                },
              );
              log.debug(`cache written`, { key, costCents: stepCost });
            }
          }
        } catch (err) {
          if (err instanceof ClientStepPendingError) {
            const primary = err.entries[0];
            const golden = runGolden();
            throw new PipelinePausedError({
              runId,
              projectId,
              cacheOwnerId,
              inputDocId,
              inputDocIds: fingerprintInputDocIds,
              fingerprintInputDocIds,
              model,
              stepIndex: i,
              startedAt,
              steps: [...steps],
              ctx: serializeCtx(ctx),
              expectedOutputs: golden,
              clientStep: {
                moduleId: m.id,
                label: m.label,
                kind: m.kind,
                code: primary?.code ?? "",
                entries: err.entries,
                input: err.input,
                pipelineState: err.pipelineState,
                expectedOutputs: golden,
                maxRunMs: customCodeMaxRunMs(m),
              },
            });
          }
          if (err instanceof LlmClientStepPendingError) {
            throw new PipelinePausedError({
              runId,
              projectId,
              cacheOwnerId,
              inputDocId,
              inputDocIds: fingerprintInputDocIds,
              fingerprintInputDocIds,
              model,
              stepIndex: i,
              startedAt,
              steps: [...steps],
              ctx: serializeCtx(ctx),
              expectedOutputs: runGolden(),
              clientStep: {
                moduleId: m.id,
                label: m.label,
                kind: m.kind,
                input: null,
                llmClient: err.llmClient,
              },
            });
          }
          if (err instanceof HumanReviewPendingError) {
            throw new PipelinePausedError({
              runId,
              projectId,
              cacheOwnerId,
              inputDocId,
              inputDocIds: fingerprintInputDocIds,
              fingerprintInputDocIds,
              model,
              stepIndex: i,
              startedAt,
              steps: [...steps],
              ctx: serializeCtx(ctx),
              expectedOutputs: runGolden(),
              clientStep: {
                moduleId: m.id,
                label: m.label,
                kind: ModuleKind.HumanReview,
                input: err.input,
              },
            });
          }
          if (err instanceof ChatbotPendingError) {
            throw new PipelinePausedError({
              runId,
              projectId,
              cacheOwnerId,
              inputDocId,
              inputDocIds: fingerprintInputDocIds,
              fingerprintInputDocIds,
              model,
              stepIndex: i,
              startedAt,
              steps: [...steps],
              ctx: serializeCtx(ctx),
              expectedOutputs: runGolden(),
              clientStep: {
                moduleId: m.id,
                label: m.label,
                kind: ModuleKind.Chatbot,
                input: err.input,
                chatbotMode: err.chatbotMode,
                model: err.model,
                maxTurns: err.maxTurns,
              },
            });
          }
          status = RunStepStatus.Error;
          if (err instanceof InputDescriptionRejectedError) {
            inputDescriptionCheck = err.check;
          }
          if (err instanceof StepCostLimitExceededError) {
            ctx.stepExtraFailures = [
              {
                kind: FailureKind.CostLimit,
                detail: err.message,
                recovered: false,
              },
            ];
          }
          result = failedStepResult(err, m, ctx, result);
          log.error(`step failed`, {
            moduleId: m.id,
            kind: m.kind,
            error: (err as Error).message,
            failedJson: result.json,
            stack: (err as Error).stack,
          });
        }

        log.info(`step finished`, {
          moduleId: m.id,
          status,
          ms: Date.now() - t0,
          costCents: +(status === "cached" ? 0 : ledger.totalCents() - beforeCents).toFixed(4),
          preview: result?.preview,
        });
        invariant(result, `step ${m.id} (${m.label}) finished without result`);
        return { status, result, descriptionCheckCostCents, descriptionCheckLlmCalls, inputDescriptionCheck, savedCostCents };
      }),
    );

    const {
      status,
      result,
      descriptionCheckCostCents = 0,
      descriptionCheckLlmCalls,
      inputDescriptionCheck,
      savedCostCents = 0,
    } = stepOutcome;

    const ms = Date.now() - t0;
    const costCents = status === "cached" ? 0 : ledger.totalCents() - beforeCents;

    if (status !== "error") {
      ctx.outputs.set(m.id, result.value);
      ctx.byLabel[labelAsStateKey(m.label)] = snapshotForByLabel(m, result.value);
      const structId = m.outStructureId ?? (m.kind === "output" || m.kind === "assert" || m.kind === "human-review" ? m.inStructureId : undefined);
      if (structId) ctx.byModel.set(structId, result.value);
      ctx.prevModuleId = m.id;
      artifacts.push({
        moduleId: m.id,
        structure: modelById(project.models, structId),
        value: result.value,
      });
    }

    steps.push({
      moduleId: m.id,
      kind: m.kind,
      label: m.label,
      model: recordStepModel(m, model),
      status,
      ms,
      costCents,
      savedCostCents: status === "cached" && savedCostCents > 0 ? savedCostCents : undefined,
      inputPreview: result.inputPreview ?? defaultInputPreview,
      inputPreviewItems: result.inputPreviewItems,
      outputPreview: result.preview,
      outputJson: result.json,
      inputDescription: m.inputDescription?.trim() || undefined,
      inputDescriptionCheck,
      descriptionCheckCostCents: descriptionCheckCostCents > 0 ? descriptionCheckCostCents : undefined,
      descriptionCheckLlmCalls: descriptionCheckLlmCalls?.length ? descriptionCheckLlmCalls : undefined,
      docId: result.docId,
      llmCalls: result.llmCalls?.length ? result.llmCalls : undefined,
      exampleSelectVerdicts: result.exampleSelectVerdicts?.length
        ? result.exampleSelectVerdicts
        : undefined,
      failures: stepFailuresFor(result, status, ctx.stepExtraFailures),
      serverLogs: stepServerLogs(serverLogs, m.id),
    });
    const stepRecord = steps[steps.length - 1]!;
    exportLangfuseRunStep(stepRecord);
    await opts.onStep?.({
      index: i,
      total: project.modules.length,
      moduleId: m.id,
      label: m.label,
      status,
      outputPreview: stepRecord.outputPreview,
      inputDescriptionCheck: stepRecord.inputDescriptionCheck,
      descriptionCheckLlmCalls: stepRecord.descriptionCheckLlmCalls,
      descriptionCheckCostCents: stepRecord.descriptionCheckCostCents,
    });
    ctx.reportSub = undefined;
    if (status === "error") {
      log.warn(`pipeline aborted after error`, { failedModule: m.id, stepsCompleted: steps.length });
      return "error";
    }
  }
  return "ok";
}
