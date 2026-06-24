import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { uid } from "../id";
import { z } from "zod";
import { DOCUMENTS_DIR, REPO_ROOT } from "./config";
import { isUnavailableSeedDoc, unavailableSeedDocMessage } from "../seed-doc";
import {
  FIELD_TYPES,
  INPUT_TYPES,
  MODULE_META,
  STRATEGY_META,
  type DocLabel,
  type InputType,
  type ModuleId,
  type ModuleKind,
  type PipelineModule,
  type Project,
  type ProjectId,
  type Strategy,
  type StrategyKind,
  type StructureModel,
} from "./types";

// AI : projects are seeded from generic JSON files under combined_full_stack/seeds/ —
// AI : author a new JSON file there to seed a new project; no TS changes needed.
// AI : cwd-anchored (not import.meta.url) so it survives Next's server bundling.
export const SEEDS_DIR = resolve(process.cwd(), "seeds");

// AI : zod guard for user-authored seed files — fails early with a precise error (config.py pattern).
const enumOf = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);
const FieldTypeSchema = enumOf(FIELD_TYPES);
const InputTypeSchema = enumOf(INPUT_TYPES.map((t) => t.value) as InputType[]);
const ModuleKindSchema = enumOf(Object.keys(MODULE_META) as ModuleKind[]);
const StrategyKindSchema = enumOf(Object.keys(STRATEGY_META) as StrategyKind[]);

const SeedFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  models: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      auto: z.boolean().optional(),
      fields: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: FieldTypeSchema,
          optional: z.boolean(),
          description: z.string(),
          example: z.string().optional(),
          ref: z.string().optional(),
        }),
      ),
    }),
  ),
  modules: z.array(
    z.object({
      id: z.string(),
      kind: ModuleKindSchema,
      label: z.string(),
      note: z.string().optional(),
      inStructureId: z.string().optional(),
      outStructureId: z.string().optional(),
      inputType: z.union([InputTypeSchema, z.array(InputTypeSchema).min(1)]).optional(),
      inputNameContains: z.string().optional(),
      prompt: z.string().optional(),
      code: z.string().optional(),
      model: z.string().optional(),
      cached: z.boolean(),
      outIsList: z.boolean().optional(),
      auto: z.boolean().optional(),
      avgMs: z.number(),
      avgCostCents: z.number(),
    }),
  ),
  strategies: z.array(
    z.object({
      id: z.string(),
      kind: StrategyKindSchema,
      name: z.string(),
      enabled: z.boolean(),
      model: z.string(),
      accuracy: z.number(),
      latencyMs: z.number(),
      costCents: z.number(),
      passRate: z.number(),
    }),
  ),
  docs: z.array(
    z.object({
      name: z.string(),
      type: InputTypeSchema,
      label: enumOf(["inference", "training"] as DocLabel[]),
      file: z.string(), // filename under the repo /documents folder
    }),
  ),
});

export interface SeedDocSpec {
  name: string;
  type: InputType;
  label: DocLabel;
  path: string; // absolute path under the repo /documents folder (pdf or plain text/json)
}

export interface ProjectSeed {
  project: Project;
  docSpecs: SeedDocSpec[];
}

export { isUnavailableSeedDoc, unavailableSeedDocMessage } from "../seed-doc";

// AI : in-app documents/ wins (Vercel bundle); monorepo dev falls back to repo-root documents/.
export function resolveSeedDocPath(relativeFile: string): string {
  const inApp = join(DOCUMENTS_DIR, relativeFile);
  if (existsSync(inApp)) return inApp;
  const atRepoRoot = join(REPO_ROOT, "documents", relativeFile);
  if (existsSync(atRepoRoot)) return atRepoRoot;
  return inApp;
}

export async function readSeedDocContent(spec: SeedDocSpec): Promise<string> {
  const txtSidecar = spec.path.replace(/\.pdf$/i, ".txt");
  if (existsSync(txtSidecar)) return readFileSync(txtSidecar, "utf8");
  if (!existsSync(spec.path)) {
    throw new Error(`seed doc missing: ${spec.path} (${spec.name})`);
  }
  return readFileSync(spec.path, "utf8");
}

// AI : the generic entry point — any validated seed JSON becomes a project + its source docs.
export function loadProjectSeed(path: string): ProjectSeed {
  const raw = SeedFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return {
    // AI : zod-validated plain strings → branded contract types
    project: {
      id: raw.id as ProjectId,
      name: raw.name,
      kind: raw.kind,
      models: raw.models as StructureModel[],
      modules: raw.modules as PipelineModule[],
      strategies: raw.strategies as Strategy[],
      seedDocNames: raw.docs.map((d) => d.name),
    },
    // AI : bug fix — seed `file` entries are now repo-/documents/-relative paths
    // AI : ("legal/legal_doc_text.pdf"), so a fresh seed no longer ENOENTs in openStore().
    docSpecs: raw.docs.map((d) => ({
      name: d.name,
      type: d.type,
      label: d.label,
      path: resolveSeedDocPath(d.file),
    })),
  };
}

// AI : every JSON under seeds/ is a project — drop a file in, it lands in the store on next boot.
export function allProjectSeeds(): ProjectSeed[] {
  return readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => loadProjectSeed(join(SEEDS_DIR, f)));
}

// AI : resolve seeded doc filenames for a project (persisted field or live seeds/ lookup).
export function projectSeedDocNames(project: Project): string[] {
  if (project.seedDocNames?.length) return project.seedDocNames;
  return allProjectSeeds().find((s) => s.project.id === project.id)?.docSpecs.map((d) => d.name) ?? [];
}

// ---- the default seed: Company Legal Evaluation, loaded (and validated) at import time ----
const defaultSeed = loadProjectSeed(join(SEEDS_DIR, "company_legal_evaluation.json"));

export const legalModels: StructureModel[] = defaultSeed.project.models;
export const legalModules: PipelineModule[] = defaultSeed.project.modules;
export const legalStrategies: Strategy[] = defaultSeed.project.strategies;
export const seedDocSpecs: SeedDocSpec[] = defaultSeed.docSpecs;

export function defaultProject(): Project {
  return structuredClone(defaultSeed.project);
}

export function blankProject(id: ProjectId): Project {
  return {
    id,
    name: "Untitled Pipeline",
    kind: "blank",
    models: [],
    modules: [
      { id: "mod_blank_in" as ModuleId, kind: "input", label: "Input", inputType: "text", cached: false, avgMs: 80, avgCostCents: 0 },
      { id: "mod_blank_out" as ModuleId, kind: "output", label: "Output", cached: false, avgMs: 40, avgCostCents: 0 },
    ],
    strategies: legalStrategies.map((s) => ({ ...s, id: `${s.id}_${id}` })),
  };
}

export type ProjectTemplateSummary = {
  id: ProjectId;
  name: string;
  kind: string;
  moduleCount: number;
  inputCount: number;
};

export function projectTemplateSummaries(): ProjectTemplateSummary[] {
  return allProjectSeeds().map((s) => ({
    id: s.project.id,
    name: s.project.name,
    kind: s.project.kind,
    moduleCount: s.project.modules.length,
    inputCount: s.project.modules.filter((m) => m.kind === "input").length,
  }));
}

// AI : clones are always numbered — "Company Legal Evaluation" → "Company Legal Evaluation 1", …
export function nextNumberedCloneName(baseName: string, existingNames: Iterable<string>): string {
  const names = new Set(existingNames);
  let n = 1;
  while (names.has(`${baseName} ${n}`)) n += 1;
  return `${baseName} ${n}`;
}

export function cloneProject(source: Project, existingProjects: Project[]): Project {
  const id = uid<ProjectId>("p_");
  const name = nextNumberedCloneName(source.name, existingProjects.map((p) => p.name));
  const cloned: Project = {
    ...structuredClone(source),
    id,
    name,
    strategies: source.strategies.map((s) => ({ ...s, id: `${s.id}_${id}` })),
  };
  return cloned;
}
