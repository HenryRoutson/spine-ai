import { NextResponse } from "next/server";
import { getJob, type RunJobId } from "@/lib/server/run_jobs";

// AI : polled by the Inference progress animation (~700ms) until run/error appears.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = getJob(id as RunJobId);
  if (!job) return NextResponse.json({ error: `unknown job ${id}` }, { status: 404 });
  return NextResponse.json(job);
}
