#!/usr/bin/env node
// AI : push seeds/*.json + documents/ into Supabase for one or all users — git is source, DB is runtime.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(appRoot, ".env.local") });
config({ path: join(appRoot, "../.env") });

const seedsDir = join(appRoot, "seeds");
const documentsDir = join(appRoot, "documents");

function hashContent(content) {
  return "sha_" + createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function unavailableSeedDocMessage(name) {
  return `[seed doc unavailable on this deploy: ${name}]`;
}

function readDocContent(spec) {
  const txtSidecar = spec.path.replace(/\.pdf$/i, ".txt");
  if (existsSync(txtSidecar)) return readFileSync(txtSidecar, "utf8");
  if (!existsSync(spec.path)) {
    throw new Error(`seed doc missing: ${spec.path}`);
  }
  return readFileSync(spec.path, "utf8");
}

function loadSeeds() {
  return readdirSync(seedsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(seedsDir, f), "utf8"));
      return {
        project: {
          id: raw.id,
          name: raw.name,
          kind: raw.kind,
          models: raw.models,
          modules: raw.modules,
          strategies: raw.strategies,
          seedDocNames: raw.docs.map((d) => d.name),
        },
        docSpecs: raw.docs.map((d) => ({
          name: d.name,
          type: d.type,
          label: d.label,
          path: join(documentsDir, d.file),
        })),
      };
    });
}

function parseArgs(argv) {
  let userId = process.env.SEED_USER_ID?.trim() || null;
  let allUsers = false;
  for (const arg of argv) {
    if (arg === "--all-users") allUsers = true;
    else if (arg.startsWith("--user-id=")) userId = arg.slice("--user-id=".length).trim();
  }
  return { userId, allUsers };
}

async function listUserIds(supabase) {
  const { data, error } = await supabase.from("projects").select("user_id");
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))];
}

async function syncUser(supabase, userId, seeds) {
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
      const content = readDocContent(spec);
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

      const { data: existing, error: lookupErr } = await supabase
        .from("docs")
        .select("id, content")
        .eq("user_id", userId)
        .eq("name", spec.name)
        .maybeSingle();
      if (lookupErr) throw lookupErr;

      if (existing && existing.id !== id) {
        const stale =
          existing.content === unavailableSeedDocMessage(spec.name) || existing.id !== id;
        if (stale) {
          const { error: delErr } = await supabase
            .from("docs")
            .delete()
            .eq("user_id", userId)
            .eq("id", existing.id);
          if (delErr) throw delErr;
          replaced += 1;
        }
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

const seeds = loadSeeds();
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const userIds = allUsers ? await listUserIds(supabase) : [userId];

if (!userIds.length) {
  console.error("No users found — sign in once so projects rows exist, or pass --user-id=");
  process.exit(1);
}

for (const uid of userIds) {
  const stats = await syncUser(supabase, uid, seeds);
  console.log(`synced user ${uid}`, stats);
}

console.log(`done — ${userIds.length} user(s), ${seeds.length} seed project(s) each`);
