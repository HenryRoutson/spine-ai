// AI : MCP Bar A — session file + HTTP, same SpineSession methods as CLI/Vibe (not seed-only).

import { createSpineSession } from "@/lib/core/session"
import { createApiEgress, createThrowingEgress, SPINE_API_TOKEN_ENV, SPINE_API_URL_ENV } from "@/lib/core/transport"
import { toValidationView } from "@/lib/core/view"
import { createFilePersist, resolveSessionPath } from "@/lib/cli/session_persist"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import type { Project } from "@/lib/types"

export function openMcpSession(sessionPath?: string, offline = false) {
  const persist = createFilePersist(resolveSessionPath(sessionPath))
  const url = process.env[SPINE_API_URL_ENV]
  const egress = offline
    ? createThrowingEgress()
    : url
      ? createApiEgress(url, process.env[SPINE_API_TOKEN_ENV])
      : undefined
  return createSpineSession({ persist, egress })
}

export function getProjectFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const project = session.project
  if (!project) throw new Error("no active project — session add-project first")
  return {
    id: project.id,
    name: project.name,
    models: project.models.map((m) => m.name),
    steps: project.modules.map((m) => ({ id: m.id, kind: m.kind, label: m.label })),
  }
}

export function validateProjectFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  return toValidationView(session.getSnapshot())
}

export function applyProjectChangesFromSession(proposal: ProjectProposal, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  session.setPendingProposal(proposal)
  session.applyPendingProposal()
  return getProjectFromSession(sessionPath)
}

export async function startRunFromSession(opts: {
  sessionPath?: string
  testDocName?: string
  testing?: boolean
}) {
  const session = openMcpSession(opts.sessionPath, false)
  const run = opts.testing ? await session.runTest(opts.testDocName) : await session.startRun()
  return { id: run.id, status: run.status, source: run.source }
}

export function sessionLogs(sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  return {
    runs: session.runs.map((r) => ({ id: r.id, status: r.status, notes: r.notes })),
    cache: session.getSnapshot().cacheEntries,
    tests: session.docs.filter((d) => d.name.endsWith("_testing.json")).map((d) => d.name),
  }
}

export function projectFromSession(sessionPath?: string): Project {
  const session = openMcpSession(sessionPath, true)
  const project = session.project
  if (!project) throw new Error("no active project")
  return project
}
