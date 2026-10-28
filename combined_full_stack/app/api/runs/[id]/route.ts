import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownRun } from "@/lib/server/api-errors";
import { parseRequestJson, patchRunBodySchema } from "@/lib/server/api_schemas";
import { cancelJob, openJobDb } from "@/lib/server/run_jobs";
import type { RunJobId } from "@/lib/run-types";
import type { RunId, RunTestReport } from "@/lib/server/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuthStore("read");
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const { id } = await params;
  const run = store.runs().find((r) => r.id === id);
  if (!run) return apiError(unknownRun(id), HTTP.NOT_FOUND);
  return NextResponse.json({ run });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { auth } = ctx;

  const { id } = await params;
  const jobDb = await openJobDb();
  const ok = await cancelJob(auth.userId, id as RunJobId, jobDb);
  if (!ok) return apiError(`Unknown or finished run job ${id}`, HTTP.NOT_FOUND);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const { id } = await params;
  const parsed = await parseRequestJson(req, patchRunBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const { notes, test } = parsed;
  const ok =
    test !== undefined
      ? store.updateRunTest(id as RunId, (test ?? undefined) as RunTestReport | undefined)
      : store.updateRunNotes(id as RunId, notes === null || notes === "" ? undefined : notes);
  if (!ok) return apiError(unknownRun(id), HTTP.NOT_FOUND);
  await store.flush();
  return NextResponse.json({ ok: true });
}
