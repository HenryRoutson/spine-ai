import { NextResponse } from "next/server";
import { requireAuthStore } from "@/lib/server/api_context";
import { resyncSeedOwnedProjects } from "@/lib/server/store";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:projects:resync-examples");

// AI : refresh built-in example pipelines from seeds/*.json without overwriting user clones.
export async function POST() {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const updated = resyncSeedOwnedProjects(store);
  await store.flush();
  apiLog.info(`resynced built-in examples`, { updated });
  return NextResponse.json({ updated });
}
