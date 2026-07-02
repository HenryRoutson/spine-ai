import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import type { DocId, InputPreviewItem, ModelId, ModuleId, Project, ProjectId } from "./types";

const cacheDir = () => join(dataDir(), "cache");
const statsPath = () => join(cacheDir(), "_stats.json");

export type StepCacheMeta = {
  projectId: ProjectId;
  moduleId: ModuleId;
  model: ModelId;
  inputDocIds: DocId[];
};

export type StepCacheArtifact = {
  value: unknown;
  json?: string;
  docId?: DocId;
  inputPreview?: string;
  inputPreviewItems?: InputPreviewItem[];
  costCents?: number;
  createdAt?: number;
  meta?: StepCacheMeta;
};

type CacheStatsEntry = {
  hits: number;
  lastHitAt?: number;
  createdAt?: number;
};

type CacheStatsFile = Record<string, CacheStatsEntry>;

export type StepCacheEntrySummary = {
  key: string;
  projectId: ProjectId;
  moduleId: ModuleId;
  model: ModelId;
  inputDocIds: DocId[];
  hits: number;
  costCents?: number;
  lastHitAt?: number;
  createdAt?: number;
  inputPreview?: string;
  sizeBytes: number;
};

function ownerPrefix(cacheOwnerId: string): string {
  return createHash("sha256").update(cacheOwnerId).digest("hex").slice(0, 12);
}

export function isStepCacheKeyOwned(key: string, cacheOwnerId: string): boolean {
  return key.startsWith(`${ownerPrefix(cacheOwnerId)}__`) && key.endsWith(".json");
}

// AI : list/detail reads must not inflate hit counts — only run_engine cache hits bump stats.
export function peekStepCache(key: string): StepCacheArtifact | undefined {
  const path = join(cacheDir(), key);
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as StepCacheArtifact;
    if (!raw || typeof raw !== "object" || !("value" in raw)) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

function artifactOutputText(artifact: StepCacheArtifact): string {
  if (artifact.json) return artifact.json;
  if (artifact.value === undefined) return "";
  return typeof artifact.value === "string" ? artifact.value : JSON.stringify(artifact.value);
}

// AI : each whitespace token must appear in the same field (subset-style search per field).
function matchesTokenQuery(haystack: string, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const h = haystack.toLowerCase();
  return tokens.every((t) => h.includes(t));
}

export type StepCacheSearchFields = {
  step?: boolean;
  input?: boolean;
  output?: boolean;
};

function matchesCacheEntryQuery(
  query: string,
  fields: StepCacheSearchFields,
  texts: { step: string; input: string; output: string },
): boolean {
  const q = query.trim();
  if (!q) return true;

  const enabled: string[] = [];
  if (fields.step) enabled.push(texts.step);
  if (fields.input) enabled.push(texts.input);
  if (fields.output) enabled.push(texts.output);
  if (!enabled.length) return true;

  return enabled.some((haystack) => matchesTokenQuery(haystack, q));
}

function readStats(): CacheStatsFile {
  const path = statsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CacheStatsFile;
  } catch {
    return {};
  }
}

function writeStats(stats: CacheStatsFile): void {
  mkdirSync(cacheDir(), { recursive: true });
  writeFileSync(statsPath(), JSON.stringify(stats, null, 2), "utf8");
}

function bumpHit(key: string): void {
  const stats = readStats();
  const now = Date.now();
  const row = stats[key] ?? { hits: 0, createdAt: now };
  row.hits += 1;
  row.lastHitAt = now;
  stats[key] = row;
  writeStats(stats);
}

export function readStepCache(key: string): StepCacheArtifact | undefined {
  const path = join(cacheDir(), key);
  if (!existsSync(path)) return undefined;
  const raw = JSON.parse(readFileSync(path, "utf8")) as StepCacheArtifact;
  if (!raw || typeof raw !== "object" || !("value" in raw)) return undefined;
  bumpHit(key);
  return raw;
}

export function writeStepCache(key: string, artifact: StepCacheArtifact, meta?: StepCacheMeta): void {
  mkdirSync(cacheDir(), { recursive: true });
  const now = Date.now();
  const stats = readStats();
  if (!stats[key]) stats[key] = { hits: 0, createdAt: now };
  writeStats(stats);
  const payload: StepCacheArtifact = {
    ...artifact,
    createdAt: artifact.createdAt ?? now,
    meta: meta ?? artifact.meta,
  };
  writeFileSync(join(cacheDir(), key), JSON.stringify(payload, null, 2), "utf8");
}

// AI : key layout is owner__projectId__moduleId__model__inputs…__cfg — model uses / not __.
function parseCacheKeyFilename(
  filename: string,
  projects: Project[],
): StepCacheMeta | undefined {
  const base = filename.endsWith(".json") ? filename.slice(0, -5) : filename;
  const parts = base.split("__");
  if (parts.length < 6) return undefined;
  const cfg = parts[parts.length - 1];
  if (!/^[a-f0-9]{12}$/.test(cfg)) return undefined;

  const projectId = parts[1] as ProjectId;
  const project = projects.find((p) => p.id === projectId);
  if (!project) return undefined;

  const moduleId = parts[2] as ModuleId;
  if (!project.modules.some((m) => m.id === moduleId)) return undefined;

  const model = parts[3] as ModelId;
  const inputParts = parts.slice(4, parts.length - 1);
  const inputDocIds =
    inputParts.length === 1 && inputParts[0] === "none" ? [] : (inputParts as DocId[]);

  return { projectId, moduleId, model, inputDocIds };
}

export function listStepCacheEntries(args: {
  cacheOwnerId: string;
  projects: Project[];
  query?: string;
  projectId?: ProjectId;
  searchFields?: StepCacheSearchFields;
}): StepCacheEntrySummary[] {
  const dir = cacheDir();
  if (!existsSync(dir)) return [];

  const prefix = ownerPrefix(args.cacheOwnerId);
  const stats = readStats();
  const q = args.query?.trim() ?? "";
  const searchFields = args.searchFields ?? {};
  const projectById = new Map(args.projects.map((p) => [p.id, p]));
  const rows: StepCacheEntrySummary[] = [];

  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name === "_stats.json") continue;
    if (!name.startsWith(`${prefix}__`)) continue;

    const path = join(dir, name);
    let artifact: StepCacheArtifact;
    try {
      artifact = JSON.parse(readFileSync(path, "utf8")) as StepCacheArtifact;
    } catch {
      continue;
    }

    const parsed =
      artifact.meta ??
      parseCacheKeyFilename(name, args.projects) ??
      ({
        projectId: name.split("__")[1] as ProjectId,
        moduleId: "unknown" as ModuleId,
        model: "unknown" as ModelId,
        inputDocIds: [],
      } satisfies StepCacheMeta);

    if (args.projectId && parsed.projectId !== args.projectId) continue;

    const project = projectById.get(parsed.projectId);
    const moduleLabel = project?.modules.find((m) => m.id === parsed.moduleId)?.label;
    const stat = stats[name];
    const hits = stat?.hits ?? 0;

    const stepText = [moduleLabel, parsed.moduleId].filter(Boolean).join(" ");
    const inputText = artifact.inputPreview ?? "";
    const outputText = artifactOutputText(artifact);

    if (
      q &&
      !matchesCacheEntryQuery(q, searchFields, {
        step: stepText,
        input: inputText,
        output: outputText,
      })
    ) {
      continue;
    }

    rows.push({
      key: name,
      projectId: parsed.projectId,
      moduleId: parsed.moduleId,
      model: parsed.model,
      inputDocIds: parsed.inputDocIds,
      hits,
      costCents: artifact.costCents,
      lastHitAt: stat?.lastHitAt,
      createdAt: artifact.createdAt ?? stat?.createdAt,
      inputPreview: artifact.inputPreview,
      sizeBytes: statSync(path).size,
    });
  }

  rows.sort((a, b) => (b.lastHitAt ?? b.createdAt ?? 0) - (a.lastHitAt ?? a.createdAt ?? 0));
  return rows;
}

export type StepCacheEntryDetail = StepCacheEntrySummary & {
  projectName?: string;
  moduleLabel?: string;
  outputJson: string;
  docId?: DocId;
  inputPreviewItems?: InputPreviewItem[];
};

export function getStepCacheEntryDetail(args: {
  cacheOwnerId: string;
  projects: Project[];
  key: string;
}): StepCacheEntryDetail | undefined {
  if (!isStepCacheKeyOwned(args.key, args.cacheOwnerId)) return undefined;

  const artifact = peekStepCache(args.key);
  if (!artifact) return undefined;

  const path = join(cacheDir(), args.key);
  const stats = readStats();
  const stat = stats[args.key];

  const parsed =
    artifact.meta ??
    parseCacheKeyFilename(args.key, args.projects) ??
    ({
      projectId: args.key.split("__")[1] as ProjectId,
      moduleId: "unknown" as ModuleId,
      model: "unknown" as ModelId,
      inputDocIds: [],
    } satisfies StepCacheMeta);

  const project = args.projects.find((p) => p.id === parsed.projectId);
  const moduleLabel = project?.modules.find((m) => m.id === parsed.moduleId)?.label;

  return {
    key: args.key,
    projectId: parsed.projectId,
    projectName: project?.name,
    moduleId: parsed.moduleId,
    moduleLabel,
    model: parsed.model,
    inputDocIds: parsed.inputDocIds,
    hits: stat?.hits ?? 0,
    costCents: artifact.costCents,
    lastHitAt: stat?.lastHitAt,
    createdAt: artifact.createdAt ?? stat?.createdAt,
    inputPreview: artifact.inputPreview,
    sizeBytes: existsSync(path) ? statSync(path).size : 0,
    outputJson: artifactOutputText(artifact),
    docId: artifact.docId,
    inputPreviewItems: artifact.inputPreviewItems,
  };
}
