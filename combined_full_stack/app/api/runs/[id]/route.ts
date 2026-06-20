import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/app_store";
import type { RunId } from "@/lib/server/types";

export const dynamic = "force-dynamic";

interface PatchRunRequest {
  notes?: string | null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { notes } = (await req.json()) as PatchRunRequest;
  const store = await getStore();
  const ok = store.updateRunNotes(id as RunId, notes === null || notes === "" ? undefined : notes);
  if (!ok) return NextResponse.json({ error: `unknown run ${id}` }, { status: 404 });
  await store.flush();
  return NextResponse.json({ ok: true });
}
