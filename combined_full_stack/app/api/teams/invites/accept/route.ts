import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { acceptTeamInviteBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { acceptTeamInvite } from "@/lib/server/teams";
import type { team_invite_token_string } from "@/lib/team-types";

export async function POST(req: Request) {
  const ctx = await requireAuthStore("write");
  if (ctx instanceof NextResponse) return ctx;
  const parsed = await parseRequestJson(req, acceptTeamInviteBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  try {
    const team = await acceptTeamInvite(
      ctx.auth.userId,
      ctx.auth.email,
      parsed.token as team_invite_token_string,
    );
    return NextResponse.json({ team });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Failed to accept invite", HTTP.BAD_REQUEST);
  }
}
