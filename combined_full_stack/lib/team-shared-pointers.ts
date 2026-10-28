// AI : team sharing is pointer-based — one canonical project/doc/run row, referenced via team_id / project_id.
import type { user_id_string } from "@/lib/server/require_auth"
import type { team_id_string } from "@/lib/team-types"
import type { DocId, Project, ProjectId } from "@/lib/types"

export type TeamSharedProjectPointer = {
  projectId: ProjectId
  teamId: team_id_string
  ownerUserId: user_id_string
  readOnly: boolean
}

export type TeamSharedDocPointer = {
  docId: DocId
  // AI : docs stay under the project owner's user_id — members read via RLS, no copy.
  ownerUserId: user_id_string
  projectId: ProjectId
}

export function isTeamSharedPointer(project: Pick<Project, "teamId" | "teamProjectOwnerId">): boolean {
  return !!project.teamId && !!project.teamProjectOwnerId
}

export function teamSharedProjectPointer(project: Project): TeamSharedProjectPointer | null {
  if (!project.teamId || !project.teamProjectOwnerId) return null
  return {
    projectId: project.id,
    teamId: project.teamId,
    ownerUserId: project.teamProjectOwnerId,
    readOnly: project.teamReadOnly === true,
  }
}
