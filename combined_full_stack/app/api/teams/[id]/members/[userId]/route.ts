import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { removeTeamMember } from "@/lib/server/teams";
import type { team_id_string } from "@/lib/team-types";
import type { user_id_string } from "@/lib/server/require_auth";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const authCtx = await requireAuthStore("write");
  if (authCtx instanceof NextResponse) return authCtx;
  const { id, userId } = await ctx.params;
  try {
    await removeTeamMember(authCtx.auth.userId, id as team_id_string, userId as user_id_string);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Failed to remove member", HTTP.BAD_REQUEST);
  }
}
