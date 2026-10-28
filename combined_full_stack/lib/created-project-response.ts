// AI : POST /api/projects used to return a bare Project — clone-site needs the minted site_ rows too.
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import type { Project } from "@/lib/types"

export type created_project_response = {
  project: Project
  sites: SharedLinkRecord[]
  siteError?: string
}

function isProjectRecord(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false
  const rec = value as { id?: unknown; modules?: unknown }
  return typeof rec.id === "string" && rec.id.length > 0 && Array.isArray(rec.modules)
}

function asSites(value: unknown): SharedLinkRecord[] {
  return Array.isArray(value) ? (value as SharedLinkRecord[]) : []
}

export function parseCreatedProjectResponse(raw: unknown): created_project_response {
  if (!raw || typeof raw !== "object") throw new Error("Invalid create project response")
  const rec = raw as Record<string, unknown>
  const siteError = typeof rec.siteError === "string" && rec.siteError.trim() ? rec.siteError : undefined
  if (isProjectRecord(rec.project)) {
    return { project: rec.project, sites: asSites(rec.sites), siteError }
  }
  if (!isProjectRecord(rec)) throw new Error("Invalid create project response")
  const { sites: _sites, siteError: _err, ...project } = rec
  return { project: project as Project, sites: asSites(rec.sites), siteError }
}
