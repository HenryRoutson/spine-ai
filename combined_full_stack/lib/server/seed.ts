import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { uid } from "../id";
import { resolveModuleNote } from "@/lib/pipeline-module-factory";
import { UNNAMED_PROJECT_NAME } from "@/lib/project-assistant-types";
import { z } from "zod";
import { DOCUMENTS_DIR, REPO_ROOT } from "./config";
import { isUnavailableSeedDoc, unavailableSeedDocMessage } from "../seed-doc";
import { TypeExprSchema } from "./spine_types";
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
      dynamic: z.boolean().optional(),
      fields: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: FieldTypeSchema,
          optional: z.boolean(),
          description: z.string(),
          example: z.string().optional(),
          ref: z.string().optional(),
          minItems: z.number().int().min(1).optional(),
          typeExpr: TypeExprSchema.optional(),
        }),
      ),
    }),
  ),
  modules: z.array(
    z.object({
      id: z.string(),
      kind: ModuleKindSchema,
      label: z.string(),
      note: z.string().default(""),
      inStructureId: z.string().optional(),
      outStructureId: z.string().optional(),
      inType: TypeExprSchema.optional(),
      outType: TypeExprSchema.optional(),
      inputType: z.union([InputTypeSchema, z.array(InputTypeSchema).min(1)]).optional(),
      inputNameContains: z.string().optional(),
      inputDescription: z.string().optional(),
      checkInputDescription: z.boolean().optional(),
      inputMinCount: z.number().int().min(1).optional(),
      prompt: z.string().optional(),
      code: z.string().optional(),
      model: z.string().optional(),
      cached: z.boolean(),
      outIsList: z.boolean().optional(),
      auto: z.boolean().optional(),
      avgMs: z.number(),
      avgCostCents: z.number(),
      fallbackList: z
        .array(z.object({ typescript: z.string().optional(), python: z.string().optional() }))
        .optional(),
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
  expectedOutputs: z
    .array(
      z.object({
        stepLabel: z.string(),
        file: z.string(), // JSON under documents/ — golden output for that step label
      }),
    )
    .optional(),
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

function loadExpectedOutputs(
  entries: { stepLabel: string; file: string }[] | undefined,
): Record<string, unknown> | undefined {
  if (!entries?.length) return undefined;
  const out: Record<string, unknown> = {};
  for (const e of entries) {
    const path = resolveSeedDocPath(e.file);
    if (!existsSync(path)) throw new Error(`expected output missing: ${path} (step "${e.stepLabel}")`);
    out[e.stepLabel] = JSON.parse(readFileSync(path, "utf8")) as unknown;
  }
  return out;
}

// AI : resolve golden outputs for assert steps — persisted on project or loaded from seeds/*.json template.
export function expectedOutputsForProject(project: Project): Record<string, unknown> {
  if (project.expectedOutputs && Object.keys(project.expectedOutputs).length) return project.expectedOutputs;
  const byId = allProjectSeeds().find((s) => s.project.id === project.id);
  if (byId?.project.expectedOutputs) return byId.project.expectedOutputs;
  const baseName = project.name.replace(/ \d+$/, "");
  const byName = allProjectSeeds().find((s) => s.project.name === baseName);
  return byName?.project.expectedOutputs ?? {};
}

// AI : the generic entry point — any validated seed JSON becomes a project + its source docs.
export function loadProjectSeed(path: string): ProjectSeed {
  const raw = SeedFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const expectedOutputs = loadExpectedOutputs(raw.expectedOutputs);
  return {
    // AI : zod-validated plain strings → branded contract types
    project: {
      id: raw.id as ProjectId,
      name: raw.name,
      kind: raw.kind,
      models: raw.models as StructureModel[],
      modules: raw.modules.map((m) => ({
        ...m,
        note: resolveModuleNote(m.kind, m.note, {
          label: m.label,
          inputDescription: m.inputDescription,
        }),
      })) as PipelineModule[],
      strategies: raw.strategies as Strategy[],
      seedDocNames: raw.docs.map((d) => d.name),
      expectedOutputs,
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

// AI : bundled template docs for this project id or numbered clone name (e.g. "… Match 1" → "… Match").
function templateSeedDocNamesForProject(project: Project): string[] {
  const byId = allProjectSeeds().find((s) => s.project.id === project.id);
  if (byId) return byId.docSpecs.map((d) => d.name);
  const baseName = project.name.replace(/ \d+$/, "");
  const byTemplate = allProjectSeeds().find((s) => s.project.name === baseName);
  return byTemplate?.docSpecs.map((d) => d.name) ?? [];
}

// AI : resolve seeded doc filenames for a project (persisted field + latest template bundled examples).
export function projectSeedDocNames(project: Project): string[] {
  const template = templateSeedDocNamesForProject(project);
  const existing = project.seedDocNames ?? [];
  if (!template.length) return existing;
  if (!existing.length) return template;
  const merged = [...existing];
  for (const n of template) {
    if (!merged.includes(n)) merged.push(n);
  }
  return merged;
}

// AI : numbered clones inherit template seedDocNames; merge in any new bundled example filenames.
export function backfillSeedDocNames(project: Project): Project {
  const merged = projectSeedDocNames(project);
  if (!merged.length) return project;
  const existing = project.seedDocNames ?? [];
  if (merged.join() === existing.join()) return project;
  return { ...project, seedDocNames: merged };
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

export function seedTemplateIds(): Set<ProjectId> {
  return new Set(allProjectSeeds().map((s) => s.project.id));
}

export function isSeedTemplateProject(project: Project): boolean {
  return seedTemplateIds().has(project.id);
}

export function userProjectsFrom(projects: Project[]): Project[] {
  const templateIds = seedTemplateIds();
  return projects.filter((p) => !templateIds.has(p.id));
}

export function blankProject(id: ProjectId): Project {
  const now = Date.now();
  return {
    id,
    name: UNNAMED_PROJECT_NAME,
    kind: "blank",
    createdAt: now,
    lastOpenedAt: now,
    models: [],
    modules: [
      { id: "mod_blank_in" as ModuleId, kind: "input", label: "Input", note: "Pipeline input document", inputType: "text", cached: true, avgMs: 80, avgCostCents: 0 },
      { id: "mod_blank_out" as ModuleId, kind: "output", label: "Output", note: "", cached: true, avgMs: 40, avgCostCents: 0 },
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
  const now = Date.now();
  const cloned: Project = {
    ...structuredClone(backfillSeedDocNames(source)),
    id,
    name,
    createdAt: now,
    lastOpenedAt: now,
    strategies: source.strategies.map((s) => ({ ...s, id: `${s.id}_${id}` })),
  };
  return cloned;
}
