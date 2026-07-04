import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { formatZodError, parseSharedLinkId, sharedDownloadQuerySchema } from "@/lib/server/api_schemas";
import { runToMarkdown } from "@/lib/server/logging";
import { verifySharedProgressToken } from "@/lib/server/shared_links";
import { openStoreForUser, getSharedLink } from "@/lib/server/shared_links";
import type { RunId } from "@/lib/server/types";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);
  const link = await getSharedLink(linkId);
  if (!link) return apiError("link not found", 404);

  const url = new URL(req.url);
  const parsed = sharedDownloadQuerySchema.safeParse({
    runId: url.searchParams.get("runId"),
    jobId: url.searchParams.get("jobId"),
    token: url.searchParams.get("token"),
    format: url.searchParams.get("format") ?? undefined,
  });
  if (!parsed.success) return apiError(formatZodError(parsed.error), HTTP.BAD_REQUEST);
  const { runId, jobId, token, format = "json" } = parsed.data;

  const entry = verifySharedProgressToken(linkId, jobId, token);
  if (!entry) return apiError("invalid token", 403);

  const store = await openStoreForUser(link.ownerId);
  const run = store.runs(link.projectId).find((r) => r.id === (runId as RunId));
  if (!run || run.sharedLinkId !== link.id) return apiError("run not found", 404);

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
