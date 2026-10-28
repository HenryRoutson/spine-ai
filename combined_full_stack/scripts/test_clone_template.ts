#!/usr/bin/env node
// AI : reproduce POST /api/projects template clone against Supabase.
import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { allProjectSeeds, cloneProject } from "../lib/server/seed";
import { migrateProjectModules } from "../lib/server/validity";
import { openUserStore } from "../lib/server/supabase_store";
import type { user_id_string } from "../lib/server/require_auth";

const appRoot = resolve(import.meta.dirname, "..");
config({ path: resolve(appRoot, ".env.local") });
config({ path: resolve(appRoot, "../.env") });

async function main() {
  const templateId = process.argv[2] ?? "p_example_select";
  const userId = process.argv[3] ?? process.env.SEED_USER_ID;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey || !userId) {
    console.error("Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and user id arg or SEED_USER_ID");
    process.exit(1);
  }

  const seed = allProjectSeeds().find((s) => s.project.id === templateId);
  if (!seed) {
    console.error(`unknown template ${templateId}`);
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as WebSocketLikeConstructor },
  });
  const store = await openUserStore(supabase, userId as user_id_string);
  const existing = store.projects();
  const project = migrateProjectModules(cloneProject(seed.project, existing));
  store.saveProject(project);
  await store.flush();
  console.log("clone ok", { templateId, projectId: project.id, name: project.name });
  store.deleteProject(project.id);
  await store.flush();
  console.log("cleaned up test clone", project.id);
}

main().catch((err) => {
  console.error("clone failed", err);
  process.exit(1);
});
