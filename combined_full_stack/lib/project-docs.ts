import type { DocRef, Project, ProjectId } from "@/lib/types";

// AI : docs are global bytes; each project lists linked filenames in seedDocNames.
export function docsForProject(docs: DocRef[], project: Project): DocRef[] {
  const names = project.seedDocNames;
  if (!names?.length) return [];
  const set = new Set(names);
  return docs.filter((d) => set.has(d.name));
}

export function docLinkedToProject(project: Project, docName: string): boolean {
  return project.seedDocNames?.includes(docName) ?? false;
}

export function projectIdsForDoc(projects: Project[], docName: string): ProjectId[] {
  return projects.filter((p) => docLinkedToProject(p, docName)).map((p) => p.id);
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
