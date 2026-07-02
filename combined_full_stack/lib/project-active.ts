import type { Project, ProjectId } from "@/lib/types"

// AI : rank for "most recently used" — explicit open beats creation time, then stable id tie-break.
export function projectOpenRank(p: Project): number {
  return p.lastOpenedAt ?? p.createdAt ?? 0
}

export function mostRecentlyOpenedProject(projects: Project[]): Project | undefined {
  if (!projects.length) return undefined
  return projects.reduce((best, p) => {
    const a = projectOpenRank(p)
    const b = projectOpenRank(best)
    if (a !== b) return a > b ? p : best
    return p.id > best.id ? p : best
  })
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
