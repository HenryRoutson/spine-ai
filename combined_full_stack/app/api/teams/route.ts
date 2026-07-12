import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { createTeamBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { HTTP } from "@/lib/server/api-errors";
import { createTeam, listTeamsForUser } from "@/lib/server/teams";

// AI : enterprise teams — list memberships and create a new team workspace.
export async function GET() {
  const ctx = await requireAuthStore("read");
  if (ctx instanceof NextResponse) return ctx;
  const teams = await listTeamsForUser(ctx.auth.userId);
  return NextResponse.json({ teams });
}

export async function POST(req: Request) {
  const ctx = await requireAuthStore("write");
  if (ctx instanceof NextResponse) return ctx;
  const parsed = await parseRequestJson(req, createTeamBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  try {
    const team = await createTeam(ctx.auth.userId, parsed.name);
    return NextResponse.json({ team });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Failed to create team", HTTP.BAD_REQUEST);
  }
}
