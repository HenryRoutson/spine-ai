import type { DocDbRow } from "./doc_ref";
import { docRefFromDbRow } from "./doc_ref";
import type { DocId, DocRef } from "./types";

export type PlatformSeedDocState = {
  docs: DocRef[];
  contents: Map<DocId, string>;
  platformSeedDocIds: Set<DocId>;
};

export function clearPlatformSeedDocState(state: PlatformSeedDocState): void {
  for (const id of state.platformSeedDocIds) {
    state.docs = state.docs.filter((d) => d.id !== id);
    state.contents.delete(id);
  }
  state.platformSeedDocIds.clear();
}

// AI : merge public.seed_docs into memory — skip names already owned by the user's docs table.
export function ingestPlatformSeedDocRows(state: PlatformSeedDocState, rows: DocDbRow[]): number {
  const names = new Set(state.docs.map((d) => d.name));
  let added = 0;
  for (const row of rows) {
    if (names.has(row.name)) continue;
    names.add(row.name);
    const id = row.id as DocId;
    state.platformSeedDocIds.add(id);
    state.docs.push(docRefFromDbRow(row));
    state.contents.set(id, row.content);
    added += 1;
  }
  return added;
}
