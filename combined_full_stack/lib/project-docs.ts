import type { DocRef, Project } from "@/lib/types";

// AI : seeded projects declare doc filenames in seeds/*.json — keep inference/uploads scoped per project.
export function docsForProject(docs: DocRef[], project: Project): DocRef[] {
  const names = project.seedDocNames;
  if (!names?.length) return docs;
  const set = new Set(names);
  return docs.filter((d) => set.has(d.name));
}

export function defaultInferenceDoc(docs: DocRef[], project: Project): DocRef | undefined {
  const mine = docsForProject(docs, project);
  return [...mine].reverse().find((d) => d.label === "inference") ?? mine[0];
}
