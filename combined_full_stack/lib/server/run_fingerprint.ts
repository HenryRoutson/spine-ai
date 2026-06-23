import { createHash } from "node:crypto";
import { docMatchesInputModule, orderedInputModules } from "../inference-input";
import { projectSeedDocNames } from "./seed";
import type { Store } from "./store";
import { migrateProjectModules } from "./validity";
import {
  DEFAULT_MODEL,
  type DocId,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type PipelineRun,
  type Project,
  type ProjectId,
  type RunFingerprint,
  type StructureModel,
} from "./types";

// AI : derived quote steps are re-generated from upstream LLM config — exclude from the hash.
function isDerivedQuoteStep(m: PipelineModule): boolean {
  return (
    m.kind === "quote" &&
    (m.auto === true || m.id.startsWith("mod_quote_") || m.id === "mod_link_quotes")
  );
}

function moduleForFingerprint(m: PipelineModule) {
  if (isDerivedQuoteStep(m)) return null;
  return {
    id: m.id,
    kind: m.kind,
    inStructureId: m.inStructureId ?? null,
    outStructureId: m.outStructureId ?? null,
    inputType: m.inputType ?? null,
    inputNameContains: m.inputNameContains ?? null,
    prompt: m.prompt ?? null,
    code: m.code ?? null,
    model: m.model ?? null,
    outIsList: m.outIsList ?? null,
  };
}

function modelForFingerprint(m: StructureModel) {
  return {
    id: m.id,
    fields: [...m.fields]
      .map((f) => ({
        id: f.id,
        type: f.type,
        optional: f.optional,
        ref: f.ref ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function resolveRunModel(project: Project, model?: ModelId): ModelId {
  return model ?? project.modules.find((m) => m.kind === "llm")?.model ?? DEFAULT_MODEL;
}

function inputDocsBySlot(project: Project, inputDocIds: DocId[]): Partial<Record<ModuleId, DocId>> {
  const slots = orderedInputModules(project.modules);
  const out: Partial<Record<ModuleId, DocId>> = {};
  for (let i = 0; i < slots.length; i++) {
    const docId = inputDocIds[i];
    if (docId) out[slots[i].id] = docId;
  }
  return out;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return v;
  });
}

// AI : same input resolution as runPipeline — explicit slot docs first, then inference fallbacks.
export function buildRunInputDocIds(
  store: Store,
  project: Project,
  inputDocId: DocId,
  extraInputDocIds?: DocId[],
): DocId[] {
  const inputMods = orderedInputModules(project.modules);
  const explicit = [inputDocId, ...(extraInputDocIds ?? [])].filter(Boolean) as DocId[];
  const seedNames = new Set(projectSeedDocNames(project));
  const inputQueue: DocId[] = [];
  const used = new Set<DocId>();
  for (let i = 0; i < inputMods.length; i++) {
    const mod = inputMods[i];
    const explicitId = explicit[i];
    if (explicitId) {
      inputQueue.push(explicitId);
      used.add(explicitId);
      continue;
    }
    const fallback = store
      .docs()
      .filter(
        (d) =>
          d.label === "inference" &&
          !used.has(d.id) &&
          (!seedNames.size || seedNames.has(d.name)) &&
          docMatchesInputModule(d, mod),
      )
      .reverse()[0]?.id;
    if (fallback) {
      inputQueue.push(fallback);
      used.add(fallback);
    }
  }
  return inputQueue;
}

function fingerprintProject(project: Project): Project {
  return migrateProjectModules(project);
}

// AI : content-addressed fingerprint — only execution-affecting config (no labels, notes, metrics, or time).
export function computeRunFingerprint(
  project: Project,
  model: ModelId | undefined,
  inputDocIds: DocId[],
): RunFingerprint {
  const inputs = inputDocsBySlot(project, inputDocIds);
  const payload = {
    v: 2 as const,
    model: resolveRunModel(project, model),
    inputs,
    models: [...project.models].sort((a, b) => a.id.localeCompare(b.id)).map(modelForFingerprint),
    modules: [...project.modules]
      .map(moduleForFingerprint)
      .filter((m): m is NonNullable<typeof m> => m != null)
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  const hex = createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 24);
  return (`runfp_${hex}`) as RunFingerprint;
}

export function computeRunFingerprintForRequest(
  store: Store,
  project: Project,
  model: ModelId | undefined,
  inputDocId: DocId,
  extraInputDocIds?: DocId[],
): { fingerprint: RunFingerprint; inputDocIds: DocId[]; project: Project } {
  const migrated = fingerprintProject(project);
  const inputDocIds = buildRunInputDocIds(store, migrated, inputDocId, extraInputDocIds);
  return {
    fingerprint: computeRunFingerprint(migrated, model, inputDocIds),
    inputDocIds,
    project: migrated,
  };
}

function inputDocIdsForRun(store: Store, project: Project, run: PipelineRun): DocId[] {
  if (run.inputDocIds?.length) return run.inputDocIds;
  if (!run.inputDocId) return [];
  return buildRunInputDocIds(store, project, run.inputDocId, []);
}

// AI : newest matching ok run wins — runs are stored newest-first in the store.
export function findMatchingRun(
  store: Store,
  project: Project,
  projectId: ProjectId,
  fingerprint: RunFingerprint,
  model?: ModelId,
): PipelineRun | undefined {
  const byColumn = store.findRunByFingerprint(projectId, fingerprint);
  if (byColumn) return byColumn;

  const migrated = fingerprintProject(project);
  const resolvedModel = resolveRunModel(migrated, model);
  for (const r of store.runs(projectId)) {
    if (r.status !== "ok") continue;
    const ids = inputDocIdsForRun(store, migrated, r);
    if (!ids.length) continue;
    if (computeRunFingerprint(migrated, resolvedModel, ids) === fingerprint) return r;
    if (computeRunFingerprint(migrated, r.model, ids) === fingerprint) return r;
  }
  return undefined;
}
