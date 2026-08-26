// AI : Pipeline step sync & migration helpers — standalone, no dependency on validity.ts I/O graph.
import type {
  ModelId,
  ModuleId,
  PipelineModule,
  Project,
  StructureModel,
  StructureModelId,
} from "./types";
import { DEFAULT_MODEL, MODULE_META, ModuleKind } from "./types";
import { DEFAULT_LLM_STEP_COST_LIMIT_CENTS } from "@/lib/llm-cost-limit";
import {
  inputModuleNeedsDocToText,
  inputModuleTypesAreAllJsonNative,
} from "@/lib/inference-input-core";
import { BUILTIN_DOCUMENT_ID, BUILTIN_CHATBOT_PROMPT_ID, BUILTIN_CHATBOT_RESULT_ID, isBuiltinDocumentModel, stripSharedModels, withSharedModels } from "./builtin_models";
import { migrateCustomCodeModule } from "@/lib/custom_code_entries";
import { migrateListMergeModule, syncListOpsModules } from "@/lib/list-ops-steps";
import { syncAssembleModules } from "@/lib/assemble-type-expr";
import { isNestedLaneKind, mapPipelineModules, syncForkModules } from "@/lib/fork-pipeline";
import { resolveModuleNote } from "@/lib/pipeline-module-factory";
import { usesPassthroughStructure, isLlmKind } from "@/lib/module-kinds";
import { assertEntriesForModule, parseAssertReferencedLabels } from "@/lib/assert_steps";
import { hasQuoteField, listFieldsForWrap } from "./structure";
import { normalizeStructureModels, stepSpineOutType, stepEmitsList } from "./type_expr";
import { migrateModulesSpineTypes, patchSpineOutList, refFromType } from "./spine_types";
import { dedupeInferredModelsByShape } from "@/lib/structure-shape";

export { stepEmitsList } from "./type_expr";

// AI : what structure a step puts on the linear spine for the *next* step (output passthrough).
export function stepEmits(m: PipelineModule | undefined): StructureModelId | undefined {
  const spine = stepSpineOutType(m);
  if (!spine) return undefined;
  if (spine.kind === "ref") return spine.modelId;
  if (spine.kind === "list" && spine.item.kind === "ref") return spine.item.modelId;
  return m?.outStructureId ?? m?.inStructureId;
}

export const AUTO_QUOTE_EXPLAINER =
  "Auto-inserted when an LLM output includes quote fields. Same model in and out (e.g. AtomicRule): the LLM returns verbatim strings; this step links them to document spans. If rules look wrong, inspect the LLM step; if quotes won't click, inspect this step.";

export const AUTO_STRUCTURE_PARSE_EXPLAINER =
  "Auto-inserted when this input's I/O model is not Document. Convert-to-text (if any) runs first so this LLM sees instantiated content. Excel and JSON-only inputs parse directly in the input step — no LLM needed.";

export const AUTO_DOC_TO_TEXT_EXPLAINER =
  "Auto-inserted when this input accepts PDF, Word, image, or web files. Input only binds the file; this step fills Document.content (parser or DeepSeek OCR) and is cached per document. If it is slow or fails, the problem is here — not on Input.";

export function isAutoStructureParseStep(m: PipelineModule): boolean {
  return (
    m.kind === ModuleKind.Llm &&
    (m.auto === true || m.id.startsWith("mod_struct_"))
  );
}

export function isAutoDocToTextStep(m: PipelineModule): boolean {
  return m.kind === ModuleKind.DocToText;
}

export function isInputManagedFollower(m: PipelineModule | undefined): boolean {
  return !!m && (isAutoDocToTextStep(m) || isAutoStructureParseStep(m));
}

function indexAfterInputManaged(modules: PipelineModule[], inputIndex: number): number {
  let j = inputIndex + 1;
  while (isInputManagedFollower(modules[j])) j++;
  return j;
}

// AI : side-input group before a combine is [input, convert?, parse?] — it feeds the combine's
// AI : newDocument and must not be treated as a spine input.
export function inputFeedsCombine(modules: PipelineModule[], i: number): boolean {
  if (modules[i]?.kind !== ModuleKind.Input) return false;
  return modules[indexAfterInputManaged(modules, i)]?.kind === ModuleKind.Combine;
}

// AI : second upload may be parsed then zipped via assemble (not combine). Allow one llm + auto quote.
export function inputFeedsAssemble(modules: PipelineModule[], i: number): boolean {
  if (modules[i]?.kind !== ModuleKind.Input) return false;
  let j = indexAfterInputManaged(modules, i);
  if (modules[j] && isLlmKind(modules[j]!.kind)) {
    j++;
    if (modules[j] && isAutoQuoteStep(modules[j]!)) j++;
  }
  return modules[j]?.kind === ModuleKind.Assemble;
}

export function isCombineSideParseStep(modules: PipelineModule[], i: number): boolean {
  const m = modules[i];
  if (!m || !isAutoStructureParseStep(m) || modules[i + 1]?.kind !== ModuleKind.Combine) return false;
  const prev = modules[i - 1];
  if (prev?.kind === ModuleKind.Input) return true;
  return !!prev && isAutoDocToTextStep(prev) && modules[i - 2]?.kind === ModuleKind.Input;
}

export function autoDocToTextStepForInput(
  modules: PipelineModule[],
  inputId: ModuleId,
): PipelineModule | undefined {
  const i = modules.findIndex((m) => m.id === inputId);
  if (i < 0) return undefined;
  const next = modules[i + 1];
  if (next && isAutoDocToTextStep(next)) return next;
  return modules.find((m) => m.id === (`mod_ocr_${inputId}` as ModuleId));
}

export function autoStructureParseStepForInput(
  modules: PipelineModule[],
  inputId: ModuleId,
): PipelineModule | undefined {
  const i = modules.findIndex((m) => m.id === inputId);
  if (i < 0) return undefined;
  let j = i + 1;
  if (modules[j] && isAutoDocToTextStep(modules[j]!)) j++;
  const next = modules[j];
  if (next && isAutoStructureParseStep(next)) return next;
  return modules.find((m) => m.id === (`mod_struct_${inputId}` as ModuleId));
}

export function inputTargetStructureId(
  input: PipelineModule,
  modules: PipelineModule[],
): StructureModelId | undefined {
  return resolveInputTargetId(input, modules);
}

export function patchInputTargetStructure(
  modules: PipelineModule[],
  inputId: ModuleId,
  structureId: StructureModelId | undefined,
): PipelineModule[] {
  const auto = autoStructureParseStepForInput(modules, inputId);
  if (auto) {
    return modules.map((m) => (m.id === auto.id ? { ...m, outStructureId: structureId } : m));
  }
  return modules.map((m) => (m.id === inputId ? { ...m, outStructureId: structureId } : m));
}

function existingStructLlmForInput(modules: PipelineModule[], inputId: ModuleId): PipelineModule | undefined {
  return autoStructureParseStepForInput(modules, inputId);
}

function resolveInputTargetId(m: PipelineModule, modules: PipelineModule[]): StructureModelId | undefined {
  const existing = existingStructLlmForInput(modules, m.id);
  if (existing?.outStructureId) return existing.outStructureId;
  if (m.outStructureId && m.outStructureId !== BUILTIN_DOCUMENT_ID) return m.outStructureId;
  const fromOutType = m.outType ? refFromType(m.outType) : undefined;
  if (fromOutType && fromOutType !== BUILTIN_DOCUMENT_ID) return fromOutType;
  return undefined;
}

function autoStructureParseStepLabel(input: PipelineModule, taken: Set<string>): string {
  return uniqueStepLabel("Parse to structure", taken, input.label.trim() || input.id);
}

function documentInputPatch(m: PipelineModule): PipelineModule {
  return {
    ...m,
    outStructureId: BUILTIN_DOCUMENT_ID,
    ...patchSpineOutList({ ...m, outStructureId: BUILTIN_DOCUMENT_ID }, stepEmitsList(m)),
  };
}

function structureSpineType(modelId: StructureModelId, isList: boolean) {
  const base = { kind: "ref" as const, modelId };
  return isList ? { kind: "list" as const, item: base } : base;
}

function targetInputPatch(m: PipelineModule, targetId: StructureModelId): PipelineModule {
  return {
    ...m,
    outStructureId: targetId,
    ...patchSpineOutList({ ...m, outStructureId: targetId }, stepEmitsList(m)),
  };
}

function stripInputOcrConfig(m: PipelineModule): PipelineModule {
  if (m.useOcr == null && m.model == null && m.prompt == null) return m;
  return { ...m, useOcr: undefined, model: undefined, prompt: undefined };
}

function foldConvertOcrOntoInput(input: PipelineModule, convert: PipelineModule | undefined): PipelineModule {
  if (!inputModuleNeedsDocToText(input)) return stripInputOcrConfig(input);
  if (!convert) return input;
  const useOcr = convert.useOcr || undefined;
  return {
    ...input,
    useOcr,
    model: useOcr ? convert.model : undefined,
    prompt: useOcr ? convert.prompt : undefined,
  };
}

// AI : authored graph — Convert to text is derived from inputType, never stored in seeds / DB JSON.
export function authoredPipelineModules(modules: PipelineModule[]): PipelineModule[] {
  const out: PipelineModule[] = [];
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    if (isAutoDocToTextStep(m)) continue;
    if (m.kind === ModuleKind.Input) {
      const next = modules[i + 1];
      const convert = next && isAutoDocToTextStep(next) ? next : autoDocToTextStepForInput(modules, m.id);
      out.push(foldConvertOcrOntoInput(m, convert));
      continue;
    }
    if (isNestedLaneKind(m.kind)) {
      out.push({
        ...m,
        forkBranches: (m.forkBranches ?? []).map((b) => ({
          ...b,
          modules: authoredPipelineModules(b.modules),
        })),
      });
      continue;
    }
    out.push(m);
  }
  return modulesEqual(modules, out) ? modules : out;
}

export function projectWithAuthoredModules(project: Project): Project {
  const modules = authoredPipelineModules(project.modules);
  return modules === project.modules ? project : { ...project, modules };
}

function autoDocToTextStepLabel(input: PipelineModule, taken: Set<string>): string {
  return uniqueStepLabel("Convert to text", taken, input.label.trim() || input.id);
}

// AI : PDF/Word/image/web → locked convert step at runtime. Authored JSON keeps OCR flags on Input.
export function syncAutoDocToTextSteps(modules: PipelineModule[]): PipelineModule[] {
  const stripped = modules.filter((m) => !isAutoDocToTextStep(m));
  const taken = new Set(stripped.map((m) => m.label.trim()).filter(Boolean));
  const out: PipelineModule[] = [];

  for (const m of stripped) {
    if (m.kind !== ModuleKind.Input) {
      out.push(m);
      continue;
    }
    if (!inputModuleNeedsDocToText(m)) {
      out.push(stripInputOcrConfig(m));
      continue;
    }
    const existing = autoDocToTextStepForInput(modules, m.id);
    const useOcr = existing?.useOcr ?? m.useOcr;
    const preferred = existing?.label.trim();
    const label =
      preferred && !taken.has(preferred) ? preferred : autoDocToTextStepLabel(m, taken);
    taken.add(label);
    const listOut = stepEmitsList(m);
    out.push(stripInputOcrConfig(m));
    out.push({
      id: (existing?.id ?? (`mod_ocr_${m.id}` as ModuleId)) as ModuleId,
      kind: ModuleKind.DocToText,
      auto: true,
      label,
      note: "Auto · Document.content None → instantiated text · parser or OCR, cached per document. Failures belong here, not on Input.",
      inStructureId: BUILTIN_DOCUMENT_ID,
      outStructureId: BUILTIN_DOCUMENT_ID,
      inType: structureSpineType(BUILTIN_DOCUMENT_ID, listOut),
      outType: structureSpineType(BUILTIN_DOCUMENT_ID, listOut),
      useOcr: useOcr || undefined,
      model: useOcr ? existing?.model ?? m.model : undefined,
      prompt: useOcr ? existing?.prompt ?? m.prompt : undefined,
      cached: true,
      avgMs: existing?.avgMs ?? 0,
      avgCostCents: existing?.avgCostCents ?? 0,
    });
  }

  return modulesEqual(modules, out) ? modules : out;
}

function makeStructureParseStep(
  input: PipelineModule,
  target: StructureModel,
  existing: PipelineModule | undefined,
  taken: Set<string>,
  globalModel: ModelId,
): PipelineModule {
  const preferred = existing?.label.trim();
  const label =
    preferred && !taken.has(preferred) ? preferred : autoStructureParseStepLabel(input, taken);
  taken.add(label);
  const listOut = stepEmitsList(input);
  return {
    id: (existing?.id ?? (`mod_struct_${input.id}` as ModuleId)) as ModuleId,
    kind: ModuleKind.Llm,
    auto: true,
    label,
    note: `Auto · Document → ${target.name} · LLM maps uploaded content into your structure.`,
    inStructureId: BUILTIN_DOCUMENT_ID,
    outStructureId: target.id,
    inType: structureSpineType(BUILTIN_DOCUMENT_ID, listOut),
    outType: structureSpineType(target.id, listOut),
    prompt:
      existing?.prompt?.trim() ||
      `Extract structured data from the uploaded document into the ${target.name} schema. Use only content from the document.`,
    model: existing?.model ?? globalModel,
    costLimitCents: existing?.costLimitCents ?? DEFAULT_LLM_STEP_COST_LIMIT_CENTS,
    cached: true,
    avgMs: existing?.avgMs ?? 0,
    avgCostCents: existing?.avgCostCents ?? 0,
  };
}

function parseTargetForInput(
  m: PipelineModule,
  modules: PipelineModule[],
  merged: StructureModel[],
): StructureModel | undefined {
  if (inputModuleTypesAreAllJsonNative(m)) return undefined;
  const targetId = resolveInputTargetId(m, modules);
  const target = targetId ? merged.find((x) => x.id === targetId) : undefined;
  if (!target || isBuiltinDocumentModel(target)) return undefined;
  return target;
}

// AI : non-JSON inputs emit Document; locked LLM step maps Document → user's target structure.
// AI : sits after convert-to-text when that step exists.
export function syncAutoStructureParseSteps(
  modules: PipelineModule[],
  models: StructureModel[],
  globalModel: ModelId = DEFAULT_MODEL,
): PipelineModule[] {
  const merged = withSharedModels(models);
  const stripped = modules.filter((m) => !isAutoStructureParseStep(m));
  const taken = new Set(stripped.map((m) => m.label.trim()).filter(Boolean));
  const out: PipelineModule[] = [];

  for (let idx = 0; idx < stripped.length; idx++) {
    const m = stripped[idx]!;
    if (m.kind === ModuleKind.Input) {
      const existing = existingStructLlmForInput(modules, m.id);
      if (inputModuleTypesAreAllJsonNative(m)) {
        const targetId = resolveInputTargetId(m, modules);
        out.push(targetId ? targetInputPatch(m, targetId) : m);
        continue;
      }
      const target = parseTargetForInput(m, modules, merged);
      out.push(documentInputPatch(m));
      const next = stripped[idx + 1];
      if (target && !isAutoDocToTextStep(next)) {
        out.push(makeStructureParseStep(m, target, existing, taken, globalModel));
      }
      continue;
    }

    out.push(m);
    if (isAutoDocToTextStep(m)) {
      const input = [...out].reverse().find((x) => x.kind === ModuleKind.Input);
      const target = input ? parseTargetForInput(input, modules, merged) : undefined;
      if (input && target) {
        const existing = existingStructLlmForInput(modules, input.id);
        out.push(makeStructureParseStep(input, target, existing, taken, globalModel));
      }
    }
  }

  return modulesEqual(modules, out) ? modules : out;
}

export function syncManagedPipelineSteps(
  modules: PipelineModule[],
  models: StructureModel[],
  globalModel: ModelId = DEFAULT_MODEL,
): PipelineModule[] {
  const outer = migrateModulesSpineTypes(
    syncAutoQuoteSteps(
      syncAutoStructureParseSteps(syncAutoDocToTextSteps(modules), models, globalModel),
      models,
    ),
  );
  return outer.map((m) => {
    if (m.kind !== ModuleKind.Fork) return m;
    return {
      ...m,
      forkBranches: (m.forkBranches ?? []).map((b) => ({
        ...b,
        modules: syncManagedPipelineSteps(b.modules, models, globalModel),
      })),
    };
  });
}

export function isAutoQuoteStep(m: PipelineModule): boolean {
  return (
    m.kind === "quote" &&
    (m.auto === true || m.id.startsWith("mod_quote_") || m.id === "mod_link_quotes")
  );
}

export function isManagedLockedStep(m: PipelineModule): boolean {
  return isAutoQuoteStep(m) || isAutoDocToTextStep(m) || isAutoStructureParseStep(m);
}

// AI : managed steps may share MODULE_META[kind].label until sync assigns unique labels.
export function isKindDefaultLabel(m: PipelineModule): boolean {
  return m.label.trim() === MODULE_META[m.kind].label;
}

export function skipDuplicateLabelCheck(m: PipelineModule): boolean {
  return isManagedLockedStep(m) && isKindDefaultLabel(m);
}

export function uniqueStepLabel(base: string, taken: Set<string>, disambiguator?: string): string {
  if (!disambiguator && !taken.has(base)) {
    taken.add(base);
    return base;
  }
  const seed = disambiguator?.trim() ? `${base} · ${disambiguator.trim()}` : base;
  if (!taken.has(seed)) {
    taken.add(seed);
    return seed;
  }
  let n = 2;
  while (taken.has(`${seed} (${n})`)) n++;
  const out = `${seed} (${n})`;
  taken.add(out);
  return out;
}

function autoQuoteStepLabel(llm: PipelineModule, taken: Set<string>): string {
  return uniqueStepLabel(MODULE_META.quote.label, taken, llm.label.trim() || llm.id);
}

function llmEmitsQuotes(m: PipelineModule, models: StructureModel[]): boolean {
  if (!isLlmKind(m.kind) || !m.outStructureId) return false;
  const out = models.find((x) => x.id === m.outStructureId);
  return !!out && hasQuoteField(out, models);
}

export function modulesEqual(a: PipelineModule[], b: PipelineModule[]): boolean {
  return a.length === b.length && a.every((m, i) => m === b[i] || JSON.stringify(m) === JSON.stringify(b[i]));
}

function existingQuoteForLlm(modules: PipelineModule[], llmId: ModuleId): PipelineModule | undefined {
  const i = modules.findIndex((m) => m.id === llmId);
  if (i < 0) return undefined;
  const next = modules[i + 1];
  if (next?.kind === "quote" && isAutoQuoteStep(next)) return next;
  return modules.find((m) => m.id === (`mod_quote_${llmId}` as ModuleId));
}

// AI : move assert steps to immediately after the latest referenced step label (by pipeline order).
export function syncAssertPlacement(modules: PipelineModule[]): PipelineModule[] {
  const asserts = modules.filter((m) => m.kind === "assert");
  if (!asserts.length) return modules;

  const spine = modules.filter((m) => m.kind !== "assert");
  const placed: PipelineModule[] = [...spine];

  for (const a of asserts) {
    const code = assertEntriesForModule(a).map((e) => e.code).join("\n");
    const labels = parseAssertReferencedLabels(code);
    let insertAfter = -1;
    for (const label of labels) {
      const idx = placed.findIndex((m) => m.label === label);
      if (idx > insertAfter) insertAfter = idx;
    }
    if (insertAfter < 0) insertAfter = placed.length - 1;

    const upstream = placed[insertAfter];
    const emits = stepEmits(upstream);
    const fixed: PipelineModule = {
      ...a,
      inStructureId: emits ?? a.inStructureId,
      outStructureId: emits ?? a.outStructureId ?? a.inStructureId,
    };
    const existingIdx = placed.findIndex((m) => m.id === a.id);
    if (existingIdx >= 0) placed.splice(existingIdx, 1);
    placed.splice(insertAfter + 1, 0, fixed);
  }

  return modulesEqual(modules, placed) ? modules : placed;
}

// AI : strip managed Link Quotes steps and re-insert immediately after each quote-emitting LLM.
export function syncAutoQuoteSteps(
  modules: PipelineModule[],
  models: StructureModel[],
): PipelineModule[] {
  const stripped = modules.filter((m) => !isAutoQuoteStep(m));
  const taken = new Set(stripped.map((m) => m.label.trim()).filter(Boolean));
  const quoteLlms = stripped.filter((m) => llmEmitsQuotes(m, models) && m.outStructureId);
  const out: PipelineModule[] = [];

  for (const m of stripped) {
    out.push(m);
    if (!llmEmitsQuotes(m, models) || !m.outStructureId) continue;
    const outModel = models.find((x) => x.id === m.outStructureId)!;
    const existing = existingQuoteForLlm(modules, m.id);
    const preferred = existing?.label.trim();
    const label =
      preferred && !taken.has(preferred)
        ? preferred
        : quoteLlms.length === 1
          ? uniqueStepLabel(MODULE_META.quote.label, taken)
          : autoQuoteStepLabel(m, taken);
    taken.add(label);
    const upstreamList = m.kind === "llm-batch" || stepEmitsList(m);
    const quoteSpine = structureSpineType(m.outStructureId, upstreamList);
    out.push({
      id: (existing?.id ?? (`mod_quote_${m.id}` as ModuleId)) as ModuleId,
      kind: ModuleKind.Quote,
      label,
      auto: true,
      note: `Auto · ${outModel.name} → ${outModel.name} · links LLM quote strings to source spans.`,
      inStructureId: m.outStructureId,
      outStructureId: m.outStructureId,
      inType: quoteSpine,
      outType: quoteSpine,
      cached: true,
      avgMs: existing?.avgMs ?? 12,
      avgCostCents: 0,
    });
  }

  return modulesEqual(modules, out) ? modules : out;
}

// AI : outStructureId on passthrough steps is display-only and must equal inStructureId to avoid
// runtime validation failures. Remove the mismatch rather than blocking the user.
function normalizePassthroughStructureIds(modules: PipelineModule[]): PipelineModule[] {
  return modules.map((m) => {
    if (!usesPassthroughStructure(m.kind)) return m;
    if (!m.outStructureId || m.outStructureId === m.inStructureId) return m;
    const { outStructureId: _, ...rest } = m;
    return { ...rest, outStructureId: m.inStructureId };
  });
}

// AI : chatbot I/O is locked to shared builtins — re-pin on migrate.
function normalizeChatbotStructureIds(modules: PipelineModule[]): PipelineModule[] {
  return modules.map((m) => {
    if (m.kind !== ModuleKind.Chatbot) return m;
    if (m.inStructureId === BUILTIN_CHATBOT_PROMPT_ID && m.outStructureId === BUILTIN_CHATBOT_RESULT_ID) {
      return m;
    }
    return {
      ...m,
      inStructureId: BUILTIN_CHATBOT_PROMPT_ID,
      outStructureId: BUILTIN_CHATBOT_RESULT_ID,
      ...patchSpineOutList(
        { ...m, outStructureId: BUILTIN_CHATBOT_RESULT_ID },
        false,
      ),
    };
  });
}

function normalizeModuleNotes(modules: PipelineModule[]): PipelineModule[] {
  return modules.map((m) => ({
    ...m,
    note: resolveModuleNote(m.kind, m.note, {
      label: m.label,
      inputDescription: m.inputDescription,
    }),
  }));
}

export function migrateProjectModules(project: Project): Project {
  // AI : dedupe only — do not remap orphan field.refs to MappingRule (hides Structure tab errors).
  // AI : dangling refs surface via computeStructureIssues; repairOrphanModelRefs stays for doc-sync.
  let models = normalizeStructureModels(
    withSharedModels(dedupeInferredModelsByShape(stripSharedModels(project.models))),
  );
  const quoted = syncManagedPipelineSteps(project.modules, models);
  const placed = syncAssertPlacement(quoted);
  const migrated = mapPipelineModules(placed, (m) => migrateListMergeModule(migrateCustomCodeModule(m)));
  const listSynced = syncListOpsModules(migrated, models);
  const assembleSynced = syncAssembleModules(listSynced.modules, models);
  const forkSynced = syncForkModules(assembleSynced.modules, assembleSynced.models);
  const withCache = mapPipelineModules(forkSynced.modules, (m) => (m.cached ? m : { ...m, cached: true }));
  models = forkSynced.models;
  const normalized = normalizePassthroughStructureIds(withCache);
  const chatbotPinned = normalizeChatbotStructureIds(normalized);
  const noted = normalizeModuleNotes(chatbotPinned);
  const spineTyped = migrateModulesSpineTypes(noted);
  const modelsChangedFlag =
    models.length !== project.models.length ||
    models.some((m, i) => {
      const prev = project.models[i];
      if (!prev || m.id !== prev.id) return true;
      return m.fields.some(
        (f, fi) => JSON.stringify(f) !== JSON.stringify(prev.fields[fi]),
      );
    });
  const changed =
    modelsChangedFlag ||
    quoted !== project.modules ||
    placed !== quoted ||
    migrated.some((m, i) => m !== placed[i]) ||
    !modulesEqual(listSynced.modules, migrated) ||
    !modulesEqual(assembleSynced.modules, listSynced.modules) ||
    !modulesEqual(forkSynced.modules, assembleSynced.modules) ||
    !modulesEqual(withCache, forkSynced.modules) ||
    normalized.some((m, i) => m !== withCache[i]) ||
    noted.some((m, i) => m !== normalized[i]) ||
    spineTyped.some((m, i) => m !== noted[i]);
  if (!changed) return project;
  return { ...project, models, modules: spineTyped };
}
