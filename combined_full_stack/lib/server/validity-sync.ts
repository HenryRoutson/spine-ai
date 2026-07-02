// AI : Pipeline step sync & migration helpers — standalone, no dependency on validity.ts I/O graph.
import type {
  ModuleId,
  PipelineModule,
  Project,
  StructureModel,
  StructureModelId,
} from "./types";
import { MODULE_META } from "./types";
import { migrateCustomCodeModule } from "@/lib/custom_code_entries";
import { resolveModuleNote } from "@/lib/pipeline-module-factory";
import { usesPassthroughStructure, isLlmKind } from "@/lib/module-kinds";
import { assertEntriesForModule, parseAssertReferencedLabels } from "@/lib/assert_steps";
import { hasQuoteField, listFieldsForWrap } from "./structure";
import { stripSharedModels, withSharedModels } from "./builtin_models";
import { stepSpineOutType, stepEmitsList } from "./type_expr";
import { migrateModulesSpineTypes } from "./spine_types";
import { dedupeInferredModelsByShape } from "@/lib/structure-shape";
import { repairOrphanModelRefs } from "@/lib/structure-ref";
import { uid } from "../id";

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

export function isAutoQuoteStep(m: PipelineModule): boolean {
  return (
    m.kind === "quote" &&
    (m.auto === true || m.id.startsWith("mod_quote_") || m.id === "mod_link_quotes")
  );
}

// AI : managed steps may share MODULE_META[kind].label until sync assigns unique labels.
export function isKindDefaultLabel(m: PipelineModule): boolean {
  return m.label.trim() === MODULE_META[m.kind].label;
}

export function skipDuplicateLabelCheck(m: PipelineModule): boolean {
  return isAutoQuoteStep(m) && isKindDefaultLabel(m);
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
    out.push({
      id: (existing?.id ?? (`mod_quote_${m.id}` as ModuleId)) as ModuleId,
      kind: "quote",
      label,
      auto: true,
      note: `Auto · ${outModel.name} → ${outModel.name} · links LLM quote strings to source spans.`,
      inStructureId: m.outStructureId,
      outStructureId: m.outStructureId,
      outIsList: !!m.outIsList || m.kind === "llm-batch",
      cached: true,
      avgMs: existing?.avgMs ?? 12,
      avgCostCents: 0,
    });
  }

  return modulesEqual(modules, out) ? modules : out;
}

// AI : fold legacy doc-to-text steps into the preceding input (parser / vision OCR now live on input).
function foldDocToTextSteps(modules: PipelineModule[]): PipelineModule[] {
  const out: PipelineModule[] = [];
  for (const m of modules) {
    if ((m.kind as string) !== "doc-to-text") {
      out.push(m);
      continue;
    }
    const prev = out[out.length - 1];
    const legacy = m as PipelineModule & { docParseMode?: "parser" | "llm" };
    const useLlm = legacy.docParseMode === "llm";
    if (prev?.kind === "input") {
      out[out.length - 1] = {
        ...prev,
        note: legacy.note ?? prev.note,
        useOcr: useLlm ? true : prev.useOcr,
        model: useLlm ? legacy.model ?? prev.model : prev.model,
        prompt: useLlm ? legacy.prompt ?? prev.prompt : prev.prompt,
        inputDescription: legacy.inputDescription ?? prev.inputDescription,
      };
    }
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
  // AI : match client useSyncProjectDocStructures — dedupe + repair before I/O validation at run time.
  let models = repairOrphanModelRefs(
    dedupeInferredModelsByShape(stripSharedModels(project.models)),
    () => uid<StructureModelId>(),
  );
  models = withSharedModels(models);
  const folded = foldDocToTextSteps(project.modules);
  const quoted = syncAutoQuoteSteps(folded, models);
  const placed = syncAssertPlacement(quoted);
  const migrated = placed.map(migrateCustomCodeModule);
  // AI : cache is always on — normalize legacy projects that disabled it per step.
  const withCache = migrated.map((m) => (m.cached ? m : { ...m, cached: true }));
  const normalized = normalizePassthroughStructureIds(withCache);
  const noted = normalizeModuleNotes(normalized);
  const spineTyped = migrateModulesSpineTypes(noted);
  const modelsChanged = models.length !== project.models.length || models.some((m, i) => m !== project.models[i]);
  const changed =
    modelsChanged ||
    folded !== project.modules ||
    placed !== folded ||
    migrated.some((m, i) => m !== placed[i]) ||
    withCache.some((m, i) => m !== migrated[i]) ||
    normalized.some((m, i) => m !== withCache[i]) ||
    noted.some((m, i) => m !== normalized[i]) ||
    spineTyped.some((m, i) => m !== noted[i]);
  if (!changed) return project;
  return { ...project, models, modules: spineTyped };
}
