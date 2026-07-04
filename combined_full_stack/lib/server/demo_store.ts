import { DEMO_DEFAULT_PROJECT_ID, DEMO_PROJECT_IDS } from "@/lib/demo-constants";
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

let cached: DemoSnapshot | null = null;

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

export async function getDemoState(_projectId: ProjectId | null) {
  const snap = await snapshot();
  const projects = snap.projects.map(migrateProjectModules);
  const modelOptions = toPublicModelOptions(await getModelOptions());
  return {
    projects,
    docs: snap.docs,
    runs: [],
    allRuns: [],
    modelOptions,
  };
}

export async function getDemoDocText(docId: DocId): Promise<string | undefined> {
  const snap = await snapshot();
  return snap.docContents.get(docId);
}
