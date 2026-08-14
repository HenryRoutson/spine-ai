import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { formatPipelineLintCopyText, lintPipelineJson } from "@/lib/server/pipeline_lint";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("Invalid JSON body", HTTP.BAD_REQUEST);
  }

  const includeExport = req.nextUrl.searchParams.get("export") !== "0";
  const result = lintPipelineJson(raw, { includeExport });
  return NextResponse.json({
    ok: result.ok,
    lints: result.lints,
    exports: result.exports,
    copyText: formatPipelineLintCopyText(result),
  });
}
