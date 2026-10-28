import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { teamInviteBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { inviteTeamMember } from "@/lib/server/teams";
import { TeamRole, type team_id_string } from "@/lib/team-types";

function inviteRoleFromBody(role: "admin" | "member"): TeamRole.Admin | TeamRole.Member {
  return role === "admin" ? TeamRole.Admin : TeamRole.Member;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore("write");
  if (authCtx instanceof NextResponse) return authCtx;
  const { id } = await ctx.params;
  const parsed = await parseRequestJson(req, teamInviteBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  try {
    const invite = await inviteTeamMember(authCtx.auth.userId, id as team_id_string, parsed.email, inviteRoleFromBody(parsed.role));
    return NextResponse.json({ invite });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Failed to invite member", HTTP.BAD_REQUEST);
  }
}
