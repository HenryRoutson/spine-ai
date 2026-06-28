import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { runToMarkdown } from "@/lib/server/logging";
import { verifySharedProgressToken } from "@/lib/server/shared_links";
import { openStoreForUser, getSharedLink } from "@/lib/server/shared_links";
import type { RunId, SharedLinkId } from "@/lib/server/types";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: linkId } = await ctx.params;
  const link = await getSharedLink(linkId as SharedLinkId);
  if (!link) return apiError("link not found", 404);

  const url = new URL(req.url);
  const runId = url.searchParams.get("runId") as RunId | null;
  const jobId = url.searchParams.get("jobId");
  const token = url.searchParams.get("token");
  if (!runId || !jobId || !token) return apiError("runId, jobId, and token required", 400);

  const entry = verifySharedProgressToken(linkId as SharedLinkId, jobId, token);
  if (!entry) return apiError("invalid token", 403);

  const store = await openStoreForUser(link.ownerId);
  const run = store.runs(link.projectId).find((r) => r.id === runId);
  if (!run || run.sharedLinkId !== link.id) return apiError("run not found", 404);

  const format = url.searchParams.get("format") ?? "json";
  if (format === "markdown") {
    return new NextResponse(runToMarkdown(run), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="run-${runId}.md"`,
      },
    });
  }

  const outputs = run.steps
    .filter((s) => s.outputJson || s.outputPreview.trim())
    .map((s) => ({
      label: s.label,
      kind: s.kind,
      status: s.status,
      json: s.outputJson,
      preview: s.outputPreview,
    }));

  return NextResponse.json({ runId, status: run.status, outputs, markdown: runToMarkdown(run) });
}
