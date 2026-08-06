import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allProjectSeeds,
  isUnavailableSeedDoc,
  readSeedDocContent,
  seedTemplateIds,
  type SeedDocSpec,
} from "./seed";
import { seedDocDbRow } from "./doc_ref";
import { hashContent } from "./store";
import type { DocId } from "./types";

export type PlatformSeedDocSyncStats = {
  docs: number;
  replaced: number;
  removedTemplateProjects: number;
  removedUserBundledDocs: number;
};

type SeedDocExistingRow = { id: string; content: string };

// AI : duplicate name rows (content-hash renames) — delete stale ids before upserting fresh bytes.
function shouldReplaceStaleSeedDocRow(
  existing: SeedDocExistingRow,
  canonicalId: DocId,
  docName: string,
): boolean {
  if (existing.id === canonicalId) return false;
  return isUnavailableSeedDoc(existing.content, docName) || existing.id !== canonicalId;
}

async function deleteStaleSeedDocRows(
  supabase: SupabaseClient,
  docName: string,
  canonicalId: DocId,
): Promise<number> {
  const { data: existingRows, error: lookupErr } = await supabase
    .from("seed_docs")
    .select("id, content")
    .eq("name", docName);
  if (lookupErr) throw lookupErr;

  let replaced = 0;
  for (const existing of existingRows ?? []) {
    if (!shouldReplaceStaleSeedDocRow(existing, canonicalId, docName)) continue;
    const { error: delErr } = await supabase.from("seed_docs").delete().eq("id", existing.id);
    if (delErr) throw delErr;
    replaced += 1;
  }
  return replaced;
}

export function allBundledSeedDocNames(): Set<string> {
  return new Set(allUniqueSeedDocSpecs().map((s) => s.name));
}

// AI : dedupe bundled examples — many seeds share the same inference JSON filenames.
export function allUniqueSeedDocSpecs(): SeedDocSpec[] {
  const seen = new Set<string>();
  const specs: SeedDocSpec[] = [];
  for (const seed of allProjectSeeds()) {
    for (const spec of seed.docSpecs) {
      if (seen.has(spec.name)) continue;
      seen.add(spec.name);
      specs.push(spec);
    }
  }
  return specs;
}

export async function upsertPlatformSeedDocs(supabase: SupabaseClient): Promise<{ docs: number; replaced: number }> {
  let docs = 0;
  let replaced = 0;

  for (const spec of allUniqueSeedDocSpecs()) {
    const content = await readSeedDocContent(spec);
    const id = hashContent(content);
    replaced += await deleteStaleSeedDocRows(supabase, spec.name, id);

    const { error: docErr } = await supabase
      .from("seed_docs")
      .upsert(seedDocDbRow({ id, name: spec.name, type: spec.type, label: spec.label, content }), {
        onConflict: "id",
      });
    if (docErr) throw docErr;
    docs += 1;
  }

  return { docs, replaced };
}

// AI : legacy sync-seeds wrote template project rows per user — templates belong in seeds/*.json only.
// AI : legacy per-user sync-seeds duplicated bundled docs into public.docs — drop them (seed_docs is canonical).
export async function purgeStaleUserBundledDocs(supabase: SupabaseClient): Promise<number> {
  const names = [...allBundledSeedDocNames()];
  if (!names.length) return 0;
  const { data, error } = await supabase.from("docs").delete().in("name", names).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function purgeUserTemplateProjects(supabase: SupabaseClient): Promise<number> {
  const templateIds = [...seedTemplateIds()];
  if (!templateIds.length) return 0;
  const { data, error } = await supabase.from("projects").delete().in("id", templateIds).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function syncPlatformSeeds(supabase: SupabaseClient): Promise<PlatformSeedDocSyncStats> {
  const { docs, replaced } = await upsertPlatformSeedDocs(supabase);
  const removedUserBundledDocs = await purgeStaleUserBundledDocs(supabase);
  const removedTemplateProjects = await purgeUserTemplateProjects(supabase);
  return { docs, replaced, removedTemplateProjects, removedUserBundledDocs };
}
