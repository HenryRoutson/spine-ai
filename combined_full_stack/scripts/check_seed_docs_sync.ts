#!/usr/bin/env node
// AI : local documents/ hashes vs public.seed_docs — catches uncommitted edits not yet synced to cloud.
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ws from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient } from "@supabase/supabase-js";
import {
  diffSeedDocHashes,
  localSeedDocHashes,
  seedDocSyncDrift,
  type CloudSeedDocHash,
  type SeedDocSyncRow,
} from "../lib/server/seed_docs_sync_check";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appRoot, "..");
config({ path: resolve(appRoot, ".env.local") });
config({ path: resolve(appRoot, "../.env") });

function gitDirtyPaths(): Set<string> {
  const result = spawnSync("git", ["status", "--porcelain", "--", "combined_full_stack/documents"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) return new Set();
  const dirty = new Set<string>();
  for (const line of (result.stdout ?? "").split("\n")) {
    const path = line.slice(3).trim();
    if (path) dirty.add(path);
  }
  return dirty;
}

function gitFlag(row: SeedDocSyncRow, dirty: Set<string>): string {
  if (!("relativeFile" in row)) return "";
  const repoPath = join("combined_full_stack/documents", row.relativeFile);
  return dirty.has(repoPath) ? "  uncommitted" : "";
}

function formatRow(row: SeedDocSyncRow, dirty: Set<string>): string {
  const flag = gitFlag(row, dirty);
  if (row.status === "ok") return `ok        ${row.name}  ${row.id}${flag}`;
  if (row.status === "mismatch") {
    return `mismatch  ${row.name}  local=${row.localId}  cloud=${row.cloudId}${flag}`;
  }
  if (row.status === "missing_in_cloud") {
    return `missing   ${row.name}  local=${row.localId}${flag}`;
  }
  return `extra     ${row.name}  cloud=${row.cloudId}`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as WebSocketLikeConstructor },
  });

  const { data, error } = await supabase.from("seed_docs").select("id, name");
  if (error) throw error;

  const local = await localSeedDocHashes();
  const cloud = (data ?? []) as CloudSeedDocHash[];
  const rows = diffSeedDocHashes(local, cloud);
  const drift = seedDocSyncDrift(rows);
  const dirty = gitDirtyPaths();
  const json = process.argv.includes("--json");

  const counts = {
    ok: rows.filter((row) => row.status === "ok").length,
    mismatch: rows.filter((row) => row.status === "mismatch").length,
    missing: rows.filter((row) => row.status === "missing_in_cloud").length,
    extra: rows.filter((row) => row.status === "extra_in_cloud").length,
  };

  if (json) {
    console.log(JSON.stringify({ counts, drift, uncommitted: [...dirty] }, null, 2));
  } else {
    for (const row of drift) console.log(formatRow(row, dirty));
    console.log(
      `${counts.ok} ok / ${counts.mismatch} mismatch / ${counts.missing} missing / ${counts.extra} extra`,
    );
  }

  if (drift.length) {
    if (!json) console.error("cloud is out of sync with local documents/ — npm run sync-seeds");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
