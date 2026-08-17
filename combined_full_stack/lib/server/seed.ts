import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { uid } from "../id";
import { resolveModuleNote } from "@/lib/pipeline-module-factory";
import { UNNAMED_PROJECT_NAME } from "@/lib/project-assistant-types";
import { z } from "zod";
import { DOCUMENTS_DIR, REPO_ROOT } from "./config";
import { isUnavailableSeedDoc, unavailableSeedDocMessage } from "../seed-doc";
import { TypeExprSchema } from "./spine_types";
import { normalizeStructureModels } from "./type_expr";
import {
  DocLabel,
  FIELD_TYPES,
  INPUT_TYPES,
  MODULE_META,
  STRATEGY_META,
  InputType,
  ModuleKind,
  type InferencePreset,
  type ModelField,
  type ModuleId,
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
// AI : Convert to text is auto-inserted from inputType — never authored in seeds/*.json.
const AUTHORED_MODULE_KINDS = (Object.keys(MODULE_META) as ModuleKind[]).filter(
  (k) => k !== ModuleKind.DocToText,
);
const ModuleKindSchema = enumOf(AUTHORED_MODULE_KINDS);
const StrategyKindSchema = enumOf(Object.keys(STRATEGY_META) as StrategyKind[]);

const fieldExampleListSchema = z.array(z.string().max(4_000)).max(32).optional();

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
      params: z.array(z.string()).optional(),
      fields: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: FieldTypeSchema,
          optional: z.boolean(),
          description: z.string(),
          example: z.string().optional(), // AI : legacy — prefer examples[]
          examples: fieldExampleListSchema,
          negativeExamples: fieldExampleListSchema,
          ref: z.string().optional(),
          minItems: z.number().int().min(1).optional(),
          maxItems: z.number().int().min(1).optional(),
          minLength: z.number().int().min(1).optional(),
          maxLength: z.number().int().min(1).optional(),
          typeExpr: TypeExprSchema.optional(),
          deterministic: z.boolean().optional(),
          testTolerance: z.number().min(0).optional(),
          // AI : TODO (sql-schema) — relation: z.discriminatedUnion("kind", [
          // AI :   z.object({ kind: z.literal("pk") }),
          // AI :   z.object({ kind: z.literal("fk"), to: z.object({ modelId: z.string(), field: z.string().min(1) }) }),
          // AI : ]).optional(),
          relation: z
            .discriminatedUnion("kind", [
              z.object({ kind: z.literal("pk") }),
              z.object({
                kind: z.literal("fk"),
                to: z.object({ modelId: z.string(), field: z.string().min(1) }),
              }),
            ])
            .optional(),
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
      inputCompatWith: z
        .object({
          moduleId: z.string(),
          keys: z.array(
            z.object({
              label: z.string(),
              compare: z.enum(["equal", "set-equal"]).optional(),
              upstream: z.discriminatedUnion("kind", [
                z.object({
                  kind: z.literal("json-path"),
                  path: z.string(),
                  normalize: z.enum(["lower-trim", "question-id", "question-id-set"]).optional(),
                }),
                z.object({
                  kind: z.literal("text-regex"),
                  pattern: z.string(),
                  group: z.number().int().optional(),
                  flags: z.string().optional(),
                  normalize: z.enum(["lower-trim", "question-id", "question-id-set"]).optional(),
                }),
                z.object({ kind: z.literal("question-ids-text") }),
              ]),
              local: z.discriminatedUnion("kind", [
                z.object({
                  kind: z.literal("json-path"),
                  path: z.string(),
                  normalize: z.enum(["lower-trim", "question-id", "question-id-set"]).optional(),
                }),
                z.object({
                  kind: z.literal("text-regex"),
                  pattern: z.string(),
                  group: z.number().int().optional(),
                  flags: z.string().optional(),
                  normalize: z.enum(["lower-trim", "question-id", "question-id-set"]).optional(),
                }),
                z.object({ kind: z.literal("question-ids-text") }),
              ]),
            }),
          ),
        })
        .optional(),
      prompt: z.string().optional(),
      code: z.string().optional(),
      maxRunMs: z.number().int().min(1).optional(),
      model: z.string().optional(),
      useOcr: z.boolean().optional(),
      costLimitCents: z.number().min(0).optional(),
      exampleContextLabel: z.string().optional(),
      exampleContextField: z.string().optional(),
      exampleReasonField: z.string().optional(),
      examplePreFilterMax: z.number().int().min(1).optional(),
      // AI : TODO (example-select-view) — examplePromptFields: z.array(z.string()).optional()
      examplePromptFields: z.array(z.string()).optional(),
      // AI : TODO (sql-schema) — examplePromptView: z.string().optional()  (module, not field)
      examplePromptView: z.string().optional(),
      mergeStateLabel: z.string().optional(),
      mergeWrapListField: z.string().optional(),
      mergeCustom: z.string().optional(),
      assembleBindings: z
        .record(
          z.string(),
          z.discriminatedUnion("kind", [
            z.object({ kind: z.literal("spine") }),
            z.object({ kind: z.literal("state"), label: z.string() }),
            z.object({
              kind: z.literal("path"),
              from: z.union([z.literal("spine"), z.object({ label: z.string() })]),
              path: z.string(),
            }),
          ]),
        )
        .optional(),
      parallelBranches: z
        .array(
          z.object({
            id: z.string(),
            field: z.string(),
            prompt: z.string(),
            outStructureId: z.string(),
            model: z.string().optional(),
            note: z.string().optional(),
          }),
        )
        .optional(),
      mergePolicy: z
        .object({
          default: z
            .object({
              list: z.string().optional(),
              dict: z.string().optional(),
              scalar: z.string().optional(),
              itemKey: z.string().optional(),
            })
            .optional(),
          rules: z
            .array(
              z.object({
                path: z.string(),
                policy: z.object({
                  list: z.string().optional(),
                  dict: z.string().optional(),
                  scalar: z.string().optional(),
                  itemKey: z.string().optional(),
                }),
              }),
            )
            .optional(),
        })
        .optional(),
      // AI : authoring defaults — omit in seeds; real latency/cost come from run history (billing.moduleMetrics).
      cached: z.boolean().default(true),
      auto: z.boolean().optional(),
      avgMs: z.number().default(0),
      avgCostCents: z.number().default(0),
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
      label: enumOf([DocLabel.Inference, DocLabel.Training]),
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
  // AI : named pre-selected inference runs (spec/TODO) — input step label → doc name(s) from `docs`.
  inferencePresets: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        inputs: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
        expectedOutputs: z
          .array(z.object({ stepLabel: z.string(), file: z.string() }))
          .optional(),
      }),
    )
    .optional(),
});

export interface SeedDocSpec {
  name: string;
  type: InputType;
  label: DocLabel;
  path: string; // absolute path under the repo /documents folder (pdf or plain text/json)
  relativeFile: string; // path relative to documents/ (e.g. billed_work_catalog_select/foo.txt)
}

export interface ProjectSeed {
  project: Project;
  docSpecs: SeedDocSpec[];
}

export { isUnavailableSeedDoc, unavailableSeedDocMessage } from "../seed-doc";

function stripSeedDocToTextModules(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as { modules?: unknown };
  if (!Array.isArray(obj.modules)) return raw;
  return {
    ...obj,
    modules: obj.modules.filter(
      (m) => !(m && typeof m === "object" && (m as { kind?: string }).kind === "doc-to-text"),
    ),
  };
}

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
  // AI : lenient for preset fixtures — the generator script must be able to load the seed before they exist.
  opts?: { lenient: boolean },
): Record<string, unknown> | undefined {
  if (!entries?.length) return undefined;
  const out: Record<string, unknown> = {};
  for (const e of entries) {
    const path = resolveSeedDocPath(e.file);
    if (!existsSync(path)) {
      if (opts?.lenient) {
        console.warn(`preset expected output missing, skipped: ${path} (step "${e.stepLabel}")`);
        continue;
      }
      throw new Error(`expected output missing: ${path} (step "${e.stepLabel}")`);
    }
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

// AI : same template fallback as expectedOutputsForProject — clones created before presets existed still get them.
export function inferencePresetsForProject(project: Project): InferencePreset[] {
  if (project.inferencePresets?.length) return project.inferencePresets;
  const byId = allProjectSeeds().find((s) => s.project.id === project.id);
  if (byId?.project.inferencePresets?.length) return byId.project.inferencePresets;
  const baseName = project.name.replace(/ \d+$/, "");
  const byName = allProjectSeeds().find((s) => s.project.name === baseName);
  return byName?.project.inferencePresets ?? [];
}

// AI : run-aware golden — a preset whose doc names match the run's inputs overrides the project default,
// AI : so assert steps pass on alternate pre-selected runs (e.g. the university LaTeX example).
export function expectedOutputsForRun(project: Project, runInputDocNames: string[]): Record<string, unknown> {
  const wanted = [...runInputDocNames].sort().join("\n");
  for (const preset of inferencePresetsForProject(project)) {
    if (!preset.expectedOutputs) continue;
    const names = Object.values(preset.inputs).flatMap((v) => (Array.isArray(v) ? v : [v]));
    if ([...names].sort().join("\n") === wanted) return preset.expectedOutputs;
  }
  return expectedOutputsForProject(project);
}

// AI : the generic entry point — any validated seed JSON becomes a project + its source docs.
export function loadProjectSeed(path: string): ProjectSeed {
  const raw = SeedFileSchema.parse(stripSeedDocToTextModules(JSON.parse(readFileSync(path, "utf8"))));
  const expectedOutputs = loadExpectedOutputs(raw.expectedOutputs);
  const inferencePresets: InferencePreset[] | undefined = raw.inferencePresets?.map((p) => ({
    name: p.name,
    description: p.description,
    inputs: p.inputs,
    expectedOutputs: loadExpectedOutputs(p.expectedOutputs, { lenient: true }),
  }));
  return {
    // AI : zod-validated plain strings → branded contract types
    project: {
      id: raw.id as ProjectId,
      name: raw.name,
      kind: raw.kind,
      models: normalizeStructureModels(raw.models as StructureModel[]),
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
      inferencePresets,
    },
    // AI : bug fix — seed `file` entries are now repo-/documents/-relative paths
    // AI : ("legal/legal_doc_text.pdf"), so a fresh seed no longer ENOENTs in openStore().
    docSpecs: raw.docs.map((d) => ({
      name: d.name,
      type: d.type,
      label: d.label,
      path: resolveSeedDocPath(d.file),
      relativeFile: d.file,
    })),
  };
}

// AI : resolve bundled seed docs for export — id, kind, then numbered-clone base name.
export function resolveProjectSeed(project: Project): ProjectSeed | undefined {
  const seeds = allProjectSeeds();
  const byId = seeds.find((s) => s.project.id === project.id);
  if (byId) return byId;
  const byKind = seeds.find((s) => s.project.kind === project.kind);
  if (byKind) return byKind;
  const baseName = project.name.replace(/ \d+$/, "");
  return seeds.find((s) => s.project.name === baseName);
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

// AI : TODO (arch-blank-project) — SpineSession has a private twin; one factory (id/strategies differ).
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
      { id: "mod_blank_in" as ModuleId, kind: ModuleKind.Input, label: "Input", note: "Pipeline input document", inputType: InputType.Text, cached: true, avgMs: 80, avgCostCents: 0 },
      { id: "mod_blank_out" as ModuleId, kind: ModuleKind.Output, label: "Output", note: "", cached: true, avgMs: 40, avgCostCents: 0 },
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

// AI : lightweight seed scan — no expected-output file reads, no full project validation.
const SeedTemplateSummaryFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  modules: z.array(z.object({ kind: ModuleKindSchema })),
});

export const PROJECT_TEMPLATE_STREAM_EVENT = {
  TEMPLATE: "template",
  DONE: "done",
  ERROR: "error",
} as const;

export function seedJsonFilenames(): string[] {
  return readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

export function projectTemplateSummaryFromFile(filename: string): ProjectTemplateSummary {
  const raw = SeedTemplateSummaryFileSchema.parse(
    stripSeedDocToTextModules(JSON.parse(readFileSync(join(SEEDS_DIR, filename), "utf8"))),
  );
  return {
    id: raw.id as ProjectId,
    name: raw.name,
    kind: raw.kind,
    moduleCount: raw.modules.length,
    inputCount: raw.modules.filter((m) => m.kind === "input").length,
  };
}

export function projectTemplateSummaries(): ProjectTemplateSummary[] {
  return seedJsonFilenames().map(projectTemplateSummaryFromFile);
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
  const { teamReadOnly: _ro, teamProjectOwnerId: _owner, ...sourceBody } = backfillSeedDocNames(source);
  const cloned: Project = {
    ...structuredClone(sourceBody),
    id,
    name,
    createdAt: now,
    lastOpenedAt: now,
    strategies: source.strategies.map((s) => ({ ...s, id: `${s.id}_${id}` })),
  };
  return cloned;
}
