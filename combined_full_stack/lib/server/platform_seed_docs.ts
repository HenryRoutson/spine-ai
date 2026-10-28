import type { DocDbRow } from "./doc_ref";
import { docRefFromDbRow } from "./doc_ref";
import { allBundledSeedDocNames } from "./seed_docs_platform";
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

// AI : bundled seed names always use public.seed_docs — replace stale per-user copies from legacy sync-seeds.
export function ingestPlatformSeedDocRows(state: PlatformSeedDocState, rows: DocDbRow[]): number {
  const bundled = allBundledSeedDocNames();
  let added = 0;
  for (const row of rows) {
    const existingIdx = state.docs.findIndex((d) => d.name === row.name);
    if (existingIdx >= 0) {
      const existing = state.docs[existingIdx]!;
      const samePlatformRow = state.platformSeedDocIds.has(existing.id) && existing.id === row.id;
      if (samePlatformRow) continue;
      if (bundled.has(row.name) || state.platformSeedDocIds.has(existing.id)) {
        state.docs.splice(existingIdx, 1);
        state.contents.delete(existing.id);
        state.platformSeedDocIds.delete(existing.id);
      } else {
        continue;
      }
    }
    const id = row.id as DocId;
    state.platformSeedDocIds.add(id);
    state.docs.push(docRefFromDbRow(row));
    state.contents.set(id, row.content);
    added += 1;
  }
  return added;
}
