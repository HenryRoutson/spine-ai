import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP, unknownDoc } from "@/lib/server/api-errors";
import { getDemoDocText } from "@/lib/server/demo_store";
import type { DocId } from "@/lib/server/types";

// AI : unauthenticated doc text for demo iframe — parser layer only.
// AI : TODO security — landing-build example docs are readable by content-hash id with no accessToken;
// AI : bind doc reads to the same HMAC gate as /api/demo/state?buildId=… or scope by buildId.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const docId = id as DocId;
  const text = await getDemoDocText(docId);
  if (text === undefined) return apiError(unknownDoc(id), HTTP.NOT_FOUND);
  return NextResponse.json({ layer: "parser", text, fromCache: true });
}
