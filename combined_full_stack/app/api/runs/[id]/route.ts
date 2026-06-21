import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import type { RunId } from "@/lib/server/types";

export const dynamic = "force-dynamic";

interface PatchRunRequest {
  notes?: string | null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const { id } = await params;
  const { notes } = (await req.json()) as PatchRunRequest;
  const ok = store.updateRunNotes(id as RunId, notes === null || notes === "" ? undefined : notes);
  if (!ok) return apiError(`unknown run ${id}`, 404);
  await store.flush();
  return NextResponse.json({ ok: true });
}
