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

type LandingBuildCache = Map<ProjectId, Project>;

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

export function putLandingBuild(project: Project): void {
  const migrated = migrateProjectModules(structuredClone(project));
  landingBuildCache().set(project.id, migrated);

  const dir = landingBuildsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(landingBuildFile(project.id), JSON.stringify(migrated));

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

function resolveLandingBuild(buildId: string | null | undefined): Project | null {
  if (!buildId) return null;
  const id = buildId as ProjectId;
  const cached = landingBuildCache().get(id);
  if (cached) return cached;

  const file = landingBuildFile(id);
  if (!existsSync(file)) return null;
  try {
    const project = migrateProjectModules(JSON.parse(readFileSync(file, "utf8")) as Project);
    landingBuildCache().set(id, project);
    return project;
  } catch {
    return null;
  }
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
  const built = resolveLandingBuild(buildId);
  if (built) {
    projects = [built, ...projects.filter((p) => p.id !== built.id)];
    projectId = built.id;
  }
  const modelOptions = toPublicModelOptions(await getModelOptions());
  const activeCandidate = built?.id ?? projectId ?? DEMO_DEFAULT_PROJECT_ID;
  const activeProjectId = projects.some((p) => p.id === activeCandidate)
    ? activeCandidate
    : DEMO_DEFAULT_PROJECT_ID;
  return {
    projects,
    docs: snap.docs,
    runs: [],
    allRuns: [],
    modelOptions,
    activeProjectId,
  };
}

export async function getDemoDocText(docId: DocId): Promise<string | undefined> {
  const snap = await snapshot();
  return snap.docContents.get(docId);
}
