// AI : pure project list ops shared by SpineSession + useStore (parity.md §8.5 thin-store).

import type { Project, ProjectId } from "@/lib/types"

export type renamed_name = string

// AI : returns null when no change (empty name or same name).
export function renamedProjects(
  projects: Project[],
  id: ProjectId | string,
  name: renamed_name,
): Project[] | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const current = projects.find((p) => p.id === id)
  if (!current || current.name === trimmed) return null
  return projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
}

export function withProjectDocumentation(project: Project, text: string): Project {
  const documentation = text.trim() ? text : undefined
  if (project.documentation === documentation) return project
  return { ...project, documentation }
}
