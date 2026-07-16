#!/usr/bin/env node
// AI : push seeds/*.json + documents/ into Supabase for one or all users — git is source, DB is runtime.
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allProjectSeeds, isUnavailableSeedDoc, readSeedDocContent } from "../lib/server/seed";
import { hashContent } from "../lib/server/store";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(appRoot, ".env.local") });
config({ path: resolve(appRoot, "../.env") });

type user_id_string = string;

function parseArgs(argv: string[]): { userId: user_id_string | null; allUsers: boolean } {
  let userId = process.env.SEED_USER_ID?.trim() || null;
  let allUsers = false;
  for (const arg of argv) {
    if (arg === "--all-users") allUsers = true;
    else if (arg.startsWith("--user-id=")) userId = arg.slice("--user-id=".length).trim();
  }
  return { userId, allUsers };
}

async function listUserIds(supabase: SupabaseClient): Promise<user_id_string[]> {
  const { data, error } = await supabase.from("projects").select("user_id");
  if (error) throw error;
  return [...new Set((data ?? []).map((r: { user_id: user_id_string }) => r.user_id).filter(Boolean))];
}

async function syncUser(
  supabase: SupabaseClient,
  userId: user_id_string,
  seeds: ReturnType<typeof allProjectSeeds>,
) {
  let projects = 0;
  let docs = 0;
  let replaced = 0;

  for (const seed of seeds) {
    const { error: projectErr } = await supabase.from("projects").upsert(
      { user_id: userId, id: seed.project.id, data: seed.project },
      { onConflict: "user_id,id" },
    );
    if (projectErr) throw projectErr;
    projects += 1;

    for (const spec of seed.docSpecs) {
      const content = await readSeedDocContent(spec);
      const id = hashContent(content);
      const docRow = {
        user_id: userId,
        id,
        name: spec.name,
        type: spec.type,
        label: spec.label,
        size_kb: Math.max(1, Math.round(content.length / 1024)),
        uploaded_at: Date.now(),
        preview: content.slice(0, 180),
        content,
      };

      // AI : duplicate name rows (content-hash renames) — delete every stale id before upserting fresh bytes.
      const { data: existingRows, error: lookupErr } = await supabase
        .from("docs")
        .select("id, content")
        .eq("user_id", userId)
        .eq("name", spec.name);
      if (lookupErr) throw lookupErr;

      for (const existing of existingRows ?? []) {
        if (existing.id === id) continue;
        const stale =
          isUnavailableSeedDoc(existing.content as string, spec.name) || existing.id !== id;
        if (!stale) continue;
        const { error: delErr } = await supabase
          .from("docs")
          .delete()
          .eq("user_id", userId)
          .eq("id", existing.id);
        if (delErr) throw delErr;
        replaced += 1;
      }

      const { error: docErr } = await supabase.from("docs").upsert(docRow, {
        onConflict: "user_id,id",
      });
      if (docErr) throw docErr;
      docs += 1;
    }
  }

  return { projects, docs, replaced };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const { userId, allUsers } = parseArgs(process.argv.slice(2));

  if (!url || !serviceKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env",
    );
    process.exit(1);
  }

  if (!allUsers && !userId) {
    console.error("Pass --user-id=<uuid> or --all-users (or set SEED_USER_ID in .env)");
    process.exit(1);
  }

  const seeds = allProjectSeeds();
  // AI : Node 20 has no native WebSocket — ws transport required for @supabase/supabase-js init.
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as WebSocketLikeConstructor },
  });
  const userIds = allUsers ? await listUserIds(supabase) : [userId!];

  if (!userIds.length) {
    console.error("No users found — sign in once so projects rows exist, or pass --user-id=");
    process.exit(1);
  }

  for (const uid of userIds) {
    const stats = await syncUser(supabase, uid, seeds);
    console.log(`synced user ${uid}`, stats);
  }

  console.log(`done — ${userIds.length} user(s), ${seeds.length} seed project(s) each`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
