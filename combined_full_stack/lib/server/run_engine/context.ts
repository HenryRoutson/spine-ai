import { invariant } from "@/lib/assert";
import { exampleSelectAcceptsWrapper } from "@/lib/example-select";
import { orderedInputModules, inputModuleNeedsOcr } from "../../inference-input";
import { documentFilenameFrom, documentValueFrom } from "../document_value";
import { stepSpineInType, stepSpineOutType } from "../type_expr";
import { stepEmits } from "../validity";
import type { ModuleId, ModelId, StructureModelId } from "../types";
import type { Store } from "../store";
import type { UsageLedger } from "../usage";
import type { Project } from "../types";
import type { RunCheckpoint } from "../run_checkpoint";
import type { RunCtx, SerializedCtx, StepInputForCheck } from "./engine_types";
import type { PipelineModule } from "../types";
import type { InputDescriptionCheckListItem } from "../input_description_check";

export function serializeCtx(ctx: RunCtx): SerializedCtx {
  return {
    inputByModule: Object.fromEntries(ctx.inputByModule) as Record<ModuleId, import("../types").DocId[]>,
    byLabel: ctx.byLabel,
    outputs: Object.fromEntries(ctx.outputs) as Record<ModuleId, unknown>,
    byModel: Object.fromEntries(ctx.byModel) as Record<StructureModelId, unknown>,
    sourceText: ctx.sourceText,
    sourceDocId: ctx.sourceDocId,
    prevModuleId: ctx.prevModuleId,
  };
}

export function restoreCtx(
  project: Project,
  store: Store,
  ledger: UsageLedger,
  model: ModelId,
  snap: SerializedCtx,
): RunCtx {
  const legacyQueue = (snap as { inputQueue?: import("../types").DocId[] }).inputQueue;
  const inputByModule =
    snap.inputByModule && Object.keys(snap.inputByModule).length
      ? new Map(Object.entries(snap.inputByModule) as [ModuleId, import("../types").DocId[]][])
      : legacyQueue?.length
        ? new Map(orderedInputModules(project.modules).map((m, i) => [m.id, legacyQueue[i] ? [legacyQueue[i]!] : []]))
        : new Map<ModuleId, import("../types").DocId[]>();
  return {
    project,
    store,
    ledger,
    model,
    inputByModule,
    byLabel: snap.byLabel ?? {},
    byModel: new Map(Object.entries(snap.byModel) as [StructureModelId, unknown][]),
    outputs: new Map(Object.entries(snap.outputs) as [ModuleId, unknown][]),
    sourceText: snap.sourceText,
    sourceDocId: snap.sourceDocId,
    prevModuleId: snap.prevModuleId,
  };
}

export function requireLinearInput(m: PipelineModule, ctx: RunCtx): unknown {
  // AI : TODO (allow-pipeline-non-linear-fork) — lane steps still use this; Fork join is a separate exec.
  const prev = ctx.prevModuleId ? ctx.project.modules.find((x) => x.id === ctx.prevModuleId) : undefined;
  const upstream = stepEmits(prev);
  if (m.inStructureId !== upstream) {
    // AI : example-select unwraps the sole list[T] field on a combine wrapper (same rule as validity).
    const expected = stepSpineInType(m);
    const actual = prev ? stepSpineOutType(prev) : undefined;
    const unwraps =
      m.kind === "example-select" &&
      !!expected &&
      !!actual &&
      exampleSelectAcceptsWrapper(expected, actual, ctx.project.models);
    if (!unwraps) {
      throw new Error(
        `step "${m.label}" expects ${m.inStructureId ?? "?"} but previous step emits ${upstream ?? "nothing"}`,
      );
    }
  }
  if (!ctx.prevModuleId) throw new Error(`step "${m.label}" has no previous step`);
  const value = ctx.outputs.get(ctx.prevModuleId);
  invariant(value !== undefined, `step "${m.label}" previous output missing for module ${ctx.prevModuleId}`);
  return value;
}

export function resolveStepInputForCheck(m: PipelineModule, ctx: RunCtx, store: Store): StepInputForCheck {
  if (m.kind === "input") {
    const docIds = ctx.inputByModule.get(m.id) ?? [];
    const allowVision = inputModuleNeedsOcr(m);
    const items = docIds.map((docId) => {
      const doc = store.docs().find((d) => d.id === docId);
      return documentValueFrom(
        undefined,
        { docId, docName: doc?.name },
        store.docContent(docId) ?? "",
      );
    });
    const first = items[0];
    const firstDocId = docIds[0];
    const listItems: InputDescriptionCheckListItem[] | undefined =
      items.length > 1
        ? items.map((item, i) => {
            const docId = docIds[i]!;
            const docName = store.docs().find((d) => d.id === docId)?.name;
            const rec = item as Record<string, unknown>;
            const label =
              (typeof rec.filename === "string" && rec.filename) || docName || `doc ${i + 1}`;
            return {
              value: item,
              vision: allowVision ? { store, docId, docName: label } : undefined,
              label,
            };
          })
        : undefined;
    return {
      value: items.length === 1 ? first : items,
      vision:
        allowVision && items.length === 1 && firstDocId
          ? { store, docId: firstDocId, docName: documentFilenameFrom(first, { docId: firstDocId }) }
          : undefined,
      items: listItems,
    };
  }
  if (m.kind === "combine") {
    const rawInput = ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined;
    const newInput = Array.isArray(rawInput) ? rawInput[0] : rawInput;
    const pipelineData = ctx.byModel.get(m.inStructureId as StructureModelId);
    return { value: { newDocument: newInput, pipelineState: pipelineData } };
  }
  if (ctx.prevModuleId) {
    return { value: requireLinearInput(m, ctx) };
  }
  return { value: undefined };
}
