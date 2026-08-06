import { NextResponse } from "next/server";
import { requireAuthStore } from "@/lib/server/api_context";
import { createAdminClient } from "@/lib/server/supabase_admin";
import { upsertPlatformSeedDocs } from "@/lib/server/seed_docs_platform";
import { ensureSeedDocs, backfillAllProjectSeedDocNames, purgeSeedTemplateProjects } from "@/lib/server/store";
import { SupabaseStore } from "@/lib/server/supabase_store";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:projects:resync-examples");

// AI : refresh bundled example documents from seeds/*.json — templates are cloned, not opened in-place.
export async function POST() {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const removed = purgeSeedTemplateProjects(store);
  let platformDocs = 0;
  const admin = await createAdminClient();
  if (admin) {
    const synced = await upsertPlatformSeedDocs(admin);
    platformDocs = synced.docs;
    if (store instanceof SupabaseStore) {
      platformDocs = await store.refreshPlatformSeedDocsFromDb();
    }
  } else {
    await ensureSeedDocs(store, { refreshStale: true });
  }
  const backfilled = backfillAllProjectSeedDocNames(store);
  await store.flush();
  apiLog.info(`resynced example docs`, { removed, platformDocs, backfilled });
  return NextResponse.json({ updated: removed + platformDocs + backfilled });
}
