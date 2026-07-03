import { NextResponse } from "next/server";
import { requireAuthStore } from "@/lib/server/api_context";
import { ensureSeedDocs, backfillAllProjectSeedDocNames, purgeSeedTemplateProjects } from "@/lib/server/store";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:projects:resync-examples");

// AI : refresh bundled example documents from seeds/*.json — templates are cloned, not opened in-place.
export async function POST() {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const removed = purgeSeedTemplateProjects(store);
  await ensureSeedDocs(store, { refreshStale: true });
  const backfilled = backfillAllProjectSeedDocNames(store);
  await store.flush();
  apiLog.info(`resynced example docs`, { removed, backfilled });
  return NextResponse.json({ updated: removed + backfilled });
}
