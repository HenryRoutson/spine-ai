import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/app_store";
import { blankProject } from "@/lib/server/seed";
import type { ProjectId } from "@/lib/server/types";

// AI : "New project" — persist a fresh blank pipeline and hand it back to the client store.
export async function POST() {
  const store = await getStore();
  const project = blankProject(("p_" + Math.random().toString(36).slice(2, 9)) as ProjectId);
  store.saveProject(project);
  await store.flush();
  return NextResponse.json(project);
}
