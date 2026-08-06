#!/usr/bin/env node
// AI : push bundled documents/ into public.seed_docs once + purge per-user template project rows.
// AI : seed templates live in seeds/*.json — users clone via POST /api/projects, not duplicated rows.
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ws from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient } from "@supabase/supabase-js";
import { allProjectSeeds } from "../lib/server/seed";
import { syncPlatformSeeds } from "../lib/server/seed_docs_platform";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(appRoot, ".env.local") });
config({ path: resolve(appRoot, "../.env") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env",
    );
    process.exit(1);
  }

  const seeds = allProjectSeeds();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as WebSocketLikeConstructor },
  });

  const stats = await syncPlatformSeeds(supabase);
  console.log("platform seed_docs", { docs: stats.docs, replaced: stats.replaced });
  console.log("removed per-user template project rows", stats.removedTemplateProjects);
  console.log(`done — ${seeds.length} seed template(s) in git, ${stats.docs} bundled doc(s) in seed_docs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
