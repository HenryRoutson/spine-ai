import { createHash } from "node:crypto";
import { buildRunInputDocIds as buildRunInputDocIdsFromDocs } from "../inference-input";
import {
  buildRunFingerprintPayload,
  moduleConfigForStepCache,
  resolveRunModel,
  stableJson,
} from "../run-fingerprint";
import { projectSeedDocNames } from "./seed";
import type { Store } from "./store";
import { migrateProjectModules } from "./validity";
import {
  type DocId,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type PipelineRun,
  type Project,
  type ProjectId,
  type RunFingerprint,
} from "./types";

// AI : per-step disk cache key — all input slot docs + execution-affecting module config.
export function stepCacheKey(
  projectId: ProjectId,
  module: PipelineModule,
  model: ModelId,
  inputDocIds: DocId[],
): string {
  const inputs = inputDocIds.length ? inputDocIds.join("__") : "none";
  const cfg = createHash("sha256")
    .update(stableJson(moduleConfigForStepCache(module)))
    .digest("hex")
    .slice(0, 12);
  const stepModel = module.model ?? model;
  return `${projectId}__${module.id}__${stepModel}__${inputs}__${cfg}.json`;
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
  const payload = buildRunFingerprintPayload(fingerprintProject(project), model, inputDocIds);
  const hex = createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 24);
  return (`runfp_${hex}`) as RunFingerprint;
}

// AI : same input resolution as runPipeline — explicit slot docs first, then inference fallbacks.
export function buildRunInputDocIds(
  store: Store,
  project: Project,
  inputDocId: DocId,
  extraInputDocIds?: DocId[],
): DocId[] {
  return buildRunInputDocIdsFromDocs(
    store.docs(),
    project,
    inputDocId,
    extraInputDocIds,
    projectSeedDocNames(project),
  );
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

export { resolveRunModel } from "../run-fingerprint";
