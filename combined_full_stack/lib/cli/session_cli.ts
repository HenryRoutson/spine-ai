// AI : CLI adapter over SpineSession — method names match useStore().

import { DocLabel, InputType } from "@/lib/types"
import { createSpineSession } from "@/lib/core/session"
import { createThrowingEgress } from "@/lib/core/transport"
import { toPipelineView, toSessionSummary, toValidationView } from "@/lib/core/view"
import { SESSION_ACTION_IDS } from "@/lib/core/actions"
import type { CliCommandResult } from "@/lib/cli/types"
import { createFilePersist, resolveSessionPath } from "@/lib/cli/session_persist"
import { addNamedModel } from "@/lib/cli/workspace_edits"

export const SPINE_SESSION_HELP = `session — headless workspace (same method names as useStore)

Usage:
  npx tsx scripts/spine-cli.ts session list [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session add-project [--open] [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session open <id> [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session rename --name <name> [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session delete <id> [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session set-docs --text <markdown> [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session add-model --name <Name> [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session add-doc --name <file> --text <content> [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session validate [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session snapshot [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts session actions [--json]

--offline  fail if a command would egress (local actions never do)
`

function ok(command: string, data: Record<string, unknown>): CliCommandResult {
  return { ok: true, command, issues: [], data }
}

function usage(message: string): CliCommandResult {
  return {
    ok: false,
    command: "usage",
    issues: [{ level: "error", where: "argv", message }],
    data: { help: SPINE_SESSION_HELP },
  }
}

export function runSessionCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): CliCommandResult {
  const sub = positional[1]
  if (!sub || sub === "help") {
    return { ok: true, command: "help", issues: [], data: { help: SPINE_SESSION_HELP } }
  }

  if (sub === "actions") {
    return ok("session actions", { actions: SESSION_ACTION_IDS })
  }

  const persist = createFilePersist(resolveSessionPath(flagString(flags, "session")))
  const session = createSpineSession({
    persist,
    egress: flags.offline === true ? createThrowingEgress() : undefined,
  })

  if (sub === "list" || sub === "snapshot") {
    const snap = session.getSnapshot()
    return ok(`session ${sub}`, {
      summary: toSessionSummary(snap),
      pipeline: toPipelineView(snap),
      projects: snap.projects.map((p) => ({ id: p.id, name: p.name })),
    })
  }

  if (sub === "add-project") {
    const project = session.addProject({ open: flags.open !== false })
    return ok("session add-project", {
      action: "addProject",
      project: { id: project.id, name: project.name },
      summary: toSessionSummary(session.getSnapshot()),
    })
  }

  if (sub === "open") {
    const id = positional[2] ?? flagString(flags, "id")
    if (!id) return usage("session open requires <id>")
    session.openProject(id)
    return ok("session open", { action: "openProject", summary: toSessionSummary(session.getSnapshot()) })
  }

  if (sub === "rename") {
    const name = flagString(flags, "name")
    const id = positional[2] ?? session.activeProjectId
    if (!name || !id) return usage("session rename requires --name and an active project")
    session.renameProject(id, name)
    return ok("session rename", { action: "renameProject", summary: toSessionSummary(session.getSnapshot()) })
  }

  if (sub === "delete") {
    const id = positional[2] ?? flagString(flags, "id")
    if (!id) return usage("session delete requires <id>")
    session.deleteProject(id)
    return ok("session delete", { action: "deleteProject", summary: toSessionSummary(session.getSnapshot()) })
  }

  if (sub === "set-docs") {
    const text = flagString(flags, "text")
    if (text == null) return usage("session set-docs requires --text")
    session.setDocumentation(text)
    return ok("session set-docs", { action: "setDocumentation", documentation: session.documentation })
  }

  if (sub === "add-model") {
    const name = flagString(flags, "name")
    if (!name) return usage("session add-model requires --name")
    addNamedModel(session, name)
    return ok("session add-model", {
      action: "applyProjectChanges",
      models: session.project?.models.map((m) => m.name) ?? [],
    })
  }

  if (sub === "add-doc") {
    const name = flagString(flags, "name") ?? "note.txt"
    const text = flagString(flags, "text")
    if (text == null) return usage("session add-doc requires --text")
    const doc = session.addDocContent({
      name,
      type: InputType.Text,
      content: text,
      label: DocLabel.Inference,
    })
    return ok("session add-doc", { action: "addDocContent", doc })
  }

  if (sub === "validate") {
    const view = toValidationView(session.getSnapshot())
    return {
      ok: view.ok,
      command: "session validate",
      issues: view.issues.map((i) => ({ level: i.level, where: i.where, message: i.message })),
      data: { action: "validate", pipeline: toPipelineView(session.getSnapshot()) },
    }
  }

  return usage(`unknown session command: ${sub}`)
}

function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key]
  return typeof v === "string" ? v : undefined
}
