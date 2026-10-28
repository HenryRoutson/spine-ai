import type { Project, ProjectId } from "@/lib/types"

// AI : rank for "most recently used" — explicit open beats creation time, then stable id tie-break.
export function projectOpenRank(p: Project): number {
  return p.lastOpenedAt ?? p.createdAt ?? 0
}

export function compareProjectsForList(a: Project, b: Project): number {
  const rank = projectOpenRank(b) - projectOpenRank(a)
  if (rank !== 0) return rank
  const byName = a.name.localeCompare(b.name)
  if (byName !== 0) return byName
  return a.id.localeCompare(b.id)
}

export function sortProjectsForList(projects: readonly Project[]): Project[] {
  return [...projects].sort(compareProjectsForList)
}

export function mostRecentlyOpenedProject(projects: Project[]): Project | undefined {
  if (!projects.length) return undefined
  return [...projects].sort(compareProjectsForList)[0]
}

export function resolveActiveProject(
  projects: Project[],
  projectId: ProjectId | string | null | undefined,
): Project | undefined {
  if (projectId) {
    const found = projects.find((p) => p.id === projectId)
    if (found) return found
  }
  return mostRecentlyOpenedProject(projects)
}
