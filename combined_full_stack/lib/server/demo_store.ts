import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_DEFAULT_PROJECT_ID, DEMO_PROJECT_IDS } from "@/lib/demo-constants";
import { dataDir } from "./config";
import { getModelOptions, toPublicModelOptions } from "./openrouter_models";
import { hashContent } from "./store";
import { allProjectSeeds, readSeedDocContent } from "./seed";
import { migrateProjectModules } from "./validity";
import type { DocId, DocLabel, DocRef, InputType, PipelineRun, Project, ProjectId } from "./types";

export { DEMO_DEFAULT_PROJECT_ID };

type DemoSnapshot = {
  projects: Project[];
  docs: DocRef[];
  docContents: Map<DocId, string>;
  runs: PipelineRun[];
};

type LandingBuildDoc = { ref: DocRef; content: string };
type LandingBuildBundle = { project: Project; docs: LandingBuildDoc[] };
type LandingBuildCache = Map<ProjectId, LandingBuildBundle>;

let cached: DemoSnapshot | null = null;
const LANDING_BUILD_CAP = 40;

// AI : Turbopack can isolate module state per route — globalThis + disk keeps builds visible to /api/demo/state.
function landingBuildCache(): LandingBuildCache {
  const g = globalThis as typeof globalThis & { __landingBuilds?: LandingBuildCache };
  if (!g.__landingBuilds) g.__landingBuilds = new Map();
  return g.__landingBuilds;
}

function landingBuildsDir(): string {
  return join(dataDir(), "landing_builds");
}

// AI : SECURITY — buildIds are `uid("p_land_")` (prefix + alphanumerics). Reject anything else so a
// AI : query param like `../../secret` can never traverse out of landing_builds/ on disk read.
const LANDING_BUILD_ID_RE = /^p_land_[a-z0-9]+$/i;

function isValidLandingBuildId(id: string): boolean {
  return LANDING_BUILD_ID_RE.test(id);
}

function landingBuildFile(id: ProjectId): string {
  return join(landingBuildsDir(), `${id}.json`);
}

function trimLandingBuildFiles(): void {
  const dir = landingBuildsDir();
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const path = join(dir, name);
      return { name, path, mtime: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  for (const stale of files.slice(LANDING_BUILD_CAP)) {
    unlinkSync(stale.path);
    landingBuildCache().delete(stale.name.replace(/\.json$/, "") as ProjectId);
  }
}

type LandingBuildDiskPayload = {
  project: Project;
  docs?: { ref: DocRef; content: string }[];
};

export function putLandingBuild(project: Project, docs: LandingBuildDoc[] = []): void {
  const migrated = migrateProjectModules(structuredClone(project));
  const bundle: LandingBuildBundle = { project: migrated, docs: structuredClone(docs) };
  landingBuildCache().set(project.id, bundle);

  const dir = landingBuildsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const payload: LandingBuildDiskPayload = { project: migrated, docs: bundle.docs };
  writeFileSync(landingBuildFile(project.id), JSON.stringify(payload));

  const cache = landingBuildCache();
  if (cache.size > LANDING_BUILD_CAP) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
      const staleFile = landingBuildFile(oldest);
      if (existsSync(staleFile)) unlinkSync(staleFile);
    }
  }
  trimLandingBuildFiles();
}

function parseLandingBuildDisk(raw: unknown): LandingBuildBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as LandingBuildDiskPayload & Project;
  // AI : legacy disk files were bare Project JSON — still load those.
  if ("id" in obj && "modules" in obj && !("project" in obj)) {
    return { project: migrateProjectModules(obj as Project), docs: [] };
  }
  if (!obj.project) return null;
  return {
    project: migrateProjectModules(obj.project),
    docs: (obj.docs ?? []).map((d) => ({ ref: d.ref, content: d.content })),
  };
}

function resolveLandingBuildBundle(buildId: string | null | undefined): LandingBuildBundle | null {
  if (!buildId || !isValidLandingBuildId(buildId)) return null;
  const id = buildId as ProjectId;
  const cached = landingBuildCache().get(id);
  if (cached) return cached;

  const file = landingBuildFile(id);
  if (!existsSync(file)) return null;
  try {
    const bundle = parseLandingBuildDisk(JSON.parse(readFileSync(file, "utf8")));
    if (!bundle) return null;
    landingBuildCache().set(id, bundle);
    return bundle;
  } catch {
    return null;
  }
}

export function getLandingBuildBundle(buildId: string): LandingBuildBundle | null {
  return resolveLandingBuildBundle(buildId);
}

function ingestDemoDoc(
  docs: DocRef[],
  docContents: Map<DocId, string>,
  name: string,
  type: InputType,
  content: string,
  label: DocLabel,
): DocRef {
  const id = hashContent(content);
  docContents.set(id, content);
  const now = Date.now();
  const existingIdx = docs.findIndex((d) => d.id === id);
  const doc: DocRef = {
    id,
    name,
    type,
    label,
    sizeKb: Math.max(1, Math.round(content.length / 1024)),
    uploadedAt: now,
    preview: content.slice(0, 180),
  };
  if (existingIdx >= 0) {
    docs[existingIdx] = doc;
    return doc;
  }
  docs.unshift(doc);
  return doc;
}

async function buildDemoSnapshot(): Promise<DemoSnapshot> {
  const seedList = allProjectSeeds().filter((s) =>
    (DEMO_PROJECT_IDS as readonly string[]).includes(s.project.id),
  );

  const docs: DocRef[] = [];
  const docContents = new Map<DocId, string>();
  const now = Date.now();

  for (const seed of seedList) {
    for (const spec of seed.docSpecs) {
      let content: string;
      try {
        content = await readSeedDocContent(spec);
      } catch {
        content = `(demo doc unavailable: ${spec.name})`;
      }
      ingestDemoDoc(docs, docContents, spec.name, spec.type, content, spec.label);
    }
  }

  const projects = seedList.map((seed, i) => {
    const migrated = migrateProjectModules(structuredClone(seed.project));
    return {
      ...migrated,
      createdAt: now - (seedList.length - i) * 86_400_000,
      lastOpenedAt: i === 0 ? now : now - i * 3_600_000,
    };
  });

  return { projects, docs, docContents, runs: [] };
}

async function snapshot(): Promise<DemoSnapshot> {
  if (!cached) cached = await buildDemoSnapshot();
  return cached;
}

export async function getDemoState(projectId: ProjectId | null, buildId?: string | null) {
  const snap = await snapshot();
  let projects = snap.projects.map(migrateProjectModules);
  let docs = snap.docs;
  const bundle = resolveLandingBuildBundle(buildId);
  if (bundle) {
    projects = [bundle.project, ...projects.filter((p) => p.id !== bundle.project.id)];
    projectId = bundle.project.id;
    const builtDocs = bundle.docs.map((d) => d.ref);
    const builtIds = new Set(builtDocs.map((d) => d.id));
    docs = [...builtDocs, ...snap.docs.filter((d) => !builtIds.has(d.id))];
  }
  const modelOptions = toPublicModelOptions(await getModelOptions());
  const activeCandidate = bundle?.project.id ?? projectId ?? DEMO_DEFAULT_PROJECT_ID;
  const activeProjectId = projects.some((p) => p.id === activeCandidate)
    ? activeCandidate
    : DEMO_DEFAULT_PROJECT_ID;
  return {
    projects,
    docs,
    runs: [],
    allRuns: [],
    modelOptions,
    activeProjectId,
  };
}

export async function getDemoDocText(docId: DocId): Promise<string | undefined> {
  // AI : TODO security — scans all landing builds by doc content-hash; pair with accessToken on the route.
  const snap = await snapshot();
  const fromSnap = snap.docContents.get(docId);
  if (fromSnap !== undefined) return fromSnap;
  for (const bundle of landingBuildCache().values()) {
    const hit = bundle.docs.find((d) => d.ref.id === docId);
    if (hit) return hit.content;
  }
  // AI : cold cache — scan recent landing build files for this doc id.
  const dir = landingBuildsDir();
  if (!existsSync(dir)) return undefined;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const bundle = parseLandingBuildDisk(JSON.parse(readFileSync(join(dir, name), "utf8")));
      const hit = bundle?.docs.find((d) => d.ref.id === docId);
      if (hit) return hit.content;
    } catch {
      continue;
    }
  }
  return undefined;
}
