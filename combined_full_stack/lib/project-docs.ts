import type { DocRef, Project } from "@/lib/types";

// AI : blank projects see every doc; seeded / cloned pipelines only see their linked filenames.
export function docsForProject(docs: DocRef[], project: Project): DocRef[] {
  const names = project.seedDocNames;
  if (!names?.length) return docs;
  const set = new Set(names);
  return docs.filter((d) => set.has(d.name));
}

export function defaultInferenceDoc(docs: DocRef[], project: Project): DocRef | undefined {
  const mine = docsForProject(docs, project);
  const names = project.seedDocNames;
  if (names?.length) {
    for (const name of names) {
      const doc = mine.find((d) => d.name === name && d.label === "inference");
      if (doc) return doc;
    }
  }
  return mine.find((d) => d.label === "inference") ?? mine[0];
}
