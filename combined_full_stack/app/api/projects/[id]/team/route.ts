import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { parseProjectId, parseRequestJson, projectTeamBodySchema } from "@/lib/server/api_schemas";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { shareProjectWithTeam, teamProjectWriteError } from "@/lib/server/teams";
import type { team_id_string } from "@/lib/team-types";

// AI : attach or detach a project from the active team workspace.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await requireAuthStore("write");
  if (authCtx instanceof NextResponse) return authCtx;
  const { store, auth } = authCtx;
  const { id: rawId } = await ctx.params;
  const projectId = parseProjectId(rawId);
  if (!projectId) return apiError(unknownProject(rawId), HTTP.NOT_FOUND);
  const project = store.project(projectId);
  if (!project) return apiError(unknownProject(projectId), HTTP.NOT_FOUND);
  const writeErr = teamProjectWriteError(project);
  if (writeErr) return apiError(writeErr, HTTP.FORBIDDEN);

  const body = await parseRequestJson(req, projectTeamBodySchema);
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);

  try {
    await shareProjectWithTeam(auth.userId, projectId, body.teamId as team_id_string | null);
    store.saveProject({ ...project, teamId: (body.teamId as team_id_string | null) ?? undefined });
    await store.flush();
    return NextResponse.json({ ok: true, teamId: body.teamId });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Failed to update team sharing", HTTP.BAD_REQUEST);
  }
}
