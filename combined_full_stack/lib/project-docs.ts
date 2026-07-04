import { DocLabel } from "@/lib/types";
import type { DocRef, Project, ProjectId } from "@/lib/types";

// AI : "testing" docs are persisted under the legacy "training" DocLabel (seeds + supabase rows);
// AI : map to the user-facing word only at display time — never show "training" in the UI.
export function docLabelDisplay(label: DocLabel): "inference" | "testing" {
  return label === DocLabel.Training ? "testing" : "inference";
}

// AI : content-addressed ids can leave multiple rows per filename — keep the newest for each name.
export function dedupeDocsNewestByName(docs: DocRef[]): DocRef[] {
  const newestByName = new Map<string, DocRef>();
  for (const d of docs) {
    const prev = newestByName.get(d.name);
    if (!prev || d.uploadedAt > prev.uploadedAt) newestByName.set(d.name, d);
  }
  const keep = new Set([...newestByName.values()].map((d) => d.id));
  return docs.filter((d) => keep.has(d.id));
}

// AI : docs are global bytes; each project lists linked filenames in seedDocNames.
// AI : content-addressed ids mean edits create a new row — keep one doc per linked name (newest wins).
export function docsForProject(docs: DocRef[], project: Project): DocRef[] {
  const names = project.seedDocNames;
  if (!names?.length) return [];
  const linked = new Set(names);
  const newestByName = new Map<string, DocRef>();
  for (const d of docs) {
    if (!linked.has(d.name)) continue;
    const prev = newestByName.get(d.name);
    if (!prev || d.uploadedAt > prev.uploadedAt) newestByName.set(d.name, d);
  }
  return names.flatMap((name) => {
    const doc = newestByName.get(name);
    return doc ? [doc] : [];
  });
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
      const doc = mine.find((d) => d.name === name && d.label === DocLabel.Inference);
      if (doc) return doc;
    }
  }
  return mine.find((d) => d.label === DocLabel.Inference) ?? mine[0];
}
