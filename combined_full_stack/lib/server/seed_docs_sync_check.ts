// AI : content-hash id of each bundled documents/ file vs public.seed_docs — git-uncommitted edits still count.
import { allUniqueSeedDocSpecs } from "./seed_docs_platform";
import { readSeedDocContent } from "./seed";
import { hashContent } from "./store";
import type { DocId } from "./types";

export type LocalSeedDocHash = {
  name: string;
  relativeFile: string;
  id: DocId;
};

export type CloudSeedDocHash = {
  name: string;
  id: string;
};

export type SeedDocSyncRow =
  | { status: "ok"; name: string; relativeFile: string; id: string }
  | { status: "mismatch"; name: string; relativeFile: string; localId: string; cloudId: string }
  | { status: "missing_in_cloud"; name: string; relativeFile: string; localId: string }
  | { status: "extra_in_cloud"; name: string; cloudId: string };

export async function localSeedDocHashes(): Promise<LocalSeedDocHash[]> {
  const out: LocalSeedDocHash[] = [];
  for (const spec of allUniqueSeedDocSpecs()) {
    const content = await readSeedDocContent(spec);
    out.push({ name: spec.name, relativeFile: spec.relativeFile, id: hashContent(content) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function diffSeedDocHashes(
  local: LocalSeedDocHash[],
  cloud: CloudSeedDocHash[],
): SeedDocSyncRow[] {
  const cloudByName = new Map(cloud.map((row) => [row.name, row]));
  const localNames = new Set(local.map((row) => row.name));
  const rows: SeedDocSyncRow[] = [];

  for (const loc of local) {
    const remote = cloudByName.get(loc.name);
    if (!remote) {
      rows.push({
        status: "missing_in_cloud",
        name: loc.name,
        relativeFile: loc.relativeFile,
        localId: loc.id,
      });
      continue;
    }
    if (remote.id !== loc.id) {
      rows.push({
        status: "mismatch",
        name: loc.name,
        relativeFile: loc.relativeFile,
        localId: loc.id,
        cloudId: remote.id,
      });
      continue;
    }
    rows.push({ status: "ok", name: loc.name, relativeFile: loc.relativeFile, id: loc.id });
  }

  for (const remote of cloud) {
    if (!localNames.has(remote.name)) {
      rows.push({ status: "extra_in_cloud", name: remote.name, cloudId: remote.id });
    }
  }

  return rows;
}

export function seedDocSyncDrift(rows: SeedDocSyncRow[]): SeedDocSyncRow[] {
  return rows.filter((row) => row.status !== "ok");
}
