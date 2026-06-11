import { NextResponse } from "next/server";
import { getJob, jobMissingDetail, openJobDb, type RunJobId } from "@/lib/server/run_jobs";

export const dynamic = "force-dynamic";

// AI : polled by the Inference progress animation (~700ms) until run/error appears.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jobDb = await openJobDb();
  const job = await getJob(id as RunJobId, jobDb);
  if (!job) {
    return NextResponse.json(
      { error: `unknown job ${id}`, detail: await jobMissingDetail(id as RunJobId, jobDb) },
      { status: 404 },
    );
  }
  return NextResponse.json(job);
}
