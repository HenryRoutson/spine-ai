// AI : launches the CLI session the way the React store is used — plus a realtime overlay check.

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DocLabel, InputType } from "@/lib/types"
import type { CliCommandResult } from "@/lib/cli/types"
import { runSessionCommand } from "@/lib/cli/session_cli"
import { createSpineSession } from "@/lib/core/session"
import { createFilePersist } from "@/lib/cli/session_persist"
import { createMemoryRealtimePort } from "@/lib/core/realtime"
import { createThrowingEgress } from "@/lib/core/transport"
import { toPipelineView, toQuoteView, toSessionSummary, toValidationView } from "@/lib/core/view"
import { SESSION_ACTION_IDS } from "@/lib/core/actions"
import { findQuote } from "@/lib/quotes"

const DEMO_SOURCE =
  "The tenant must keep the premises insured at all times against fire and flood."
const DEMO_QUOTE = "keep the premises insured"

export async function runDemoCommand(opts: {
  keepSession?: boolean
  sessionPath?: string
}): Promise<CliCommandResult> {
  const dir = opts.sessionPath ? undefined : mkdtempSync(join(tmpdir(), "spine-demo-"))
  const sessionPath = opts.sessionPath ?? join(dir!, "session.json")
  const steps: { positional: string[]; flags: Record<string, string | boolean> }[] = [
    { positional: ["session", "add-project"], flags: { open: true, session: sessionPath } },
    { positional: ["session", "rename"], flags: { name: "CLI Demo Pipeline", session: sessionPath } },
    {
      positional: ["session", "set-docs"],
      flags: { text: "Local-first demo: quotes stay on this machine.", session: sessionPath },
    },
    { positional: ["session", "add-model"], flags: { name: "Finding", session: sessionPath } },
    {
      positional: ["session", "add-field"],
      flags: { model: "Finding", name: "title", type: "text", session: sessionPath },
    },
    {
      positional: ["session", "add-doc"],
      flags: { name: "lease.txt", text: DEMO_SOURCE, session: sessionPath },
    },
    {
      positional: ["session", "assign-input"],
      flags: { module: "Input", doc: "lease.txt", session: sessionPath },
    },
    { positional: ["session", "structure"], flags: { session: sessionPath } },
    { positional: ["session", "cache"], flags: { session: sessionPath } },
    { positional: ["session", "share"], flags: { session: sessionPath } },
    { positional: ["session", "billing"], flags: { session: sessionPath, offline: true } },
    { positional: ["session", "validate"], flags: { session: sessionPath } },
    { positional: ["session", "snapshot"], flags: { session: sessionPath } },
  ]

  const launched: Record<string, unknown>[] = []
  for (const step of steps) {
    const result = await runSessionCommand(step.positional, step.flags)
    launched.push({
      argv: [...step.positional, `--session ${sessionPath}`],
      command: result.command,
      ok: result.ok,
      action: result.data?.action,
    })
    if (!result.ok) {
      if (dir && !opts.keepSession) rmSync(dir, { recursive: true, force: true })
      return {
        ok: false,
        command: "demo",
        issues: result.issues,
        data: { launched, failedAt: result.command, sessionPath },
      }
    }
  }

  const session = createSpineSession({
    persist: createFilePersist(sessionPath),
    egress: createThrowingEgress(),
  })
  const bus = createMemoryRealtimePort()
  let projectTicks = 0
  session.attachRealtime(bus, {
    onProjectsChanged: () => {
      projectTicks += 1
    },
  })

  const created = session.project
  if (!created) {
    return {
      ok: false,
      command: "demo",
      issues: [{ level: "error", where: "demo", message: "CLI add-project left no active project" }],
      data: { launched, sessionPath },
    }
  }

  // AI : stale realtime snapshot (other browser) must not drop the local create — same overlay as store.tsx.
  session.ingestRemoteProjects([])
  const keptAfterStale = session.projects.some((p) => p.id === created.id)

  bus.emit({ table: "projects", kind: "projects", eventType: "INSERT" })
  session.ingestRemoteProjects([created])
  const confirmed = session.getSnapshot().pendingCreates.length === 0

  const match = findQuote(DEMO_QUOTE, DEMO_SOURCE, session.docs[0]!.id)
  const quote = toQuoteView(match)
  const linked = session.linkQuotes({
    quote: DEMO_QUOTE,
    sourceText: DEMO_SOURCE,
    docId: session.docs[0]!.id,
  })

  const clone = session.cloneProject(created.id, { open: false })
  session.deleteProject(clone.id)
  session.ingestRemoteProjects([created, clone])
  const tombstoneHidesClone = !session.projects.some((p) => p.id === clone.id)

  const snap = session.getSnapshot()
  const human = [
    "spine demo — React store API via CLI",
    `session: ${sessionPath}`,
    `project: ${created.name} (${created.id})`,
    `docs: ${session.documentation}`,
    `pipeline: ${toPipelineView(snap)?.steps.map((s) => s.label).join(" → ")}`,
    `quote: ${quote.href} exact=${quote.exact}`,
    `realtime stale create kept: ${keptAfterStale}`,
    `realtime confirm pendingCreates=0: ${confirmed}`,
    `realtime ticks: ${projectTicks}`,
    `delete tombstone hides clone: ${tombstoneHidesClone}`,
    `validation: ${toValidationView(snap).ok ? "ok" : "issues"}`,
    `egress bytes (must stay 0): ${session.egress?.bytesSent ?? 0}`,
  ].join("\n")

  if (dir && !opts.keepSession) rmSync(dir, { recursive: true, force: true })

  return {
    ok: keptAfterStale && confirmed && tombstoneHidesClone && linked.href === quote.href,
    command: "demo",
    issues: [],
    data: {
      human,
      actions: SESSION_ACTION_IDS,
      launched,
      summary: toSessionSummary(snap),
      quote,
      realtime: {
        keptAfterStale,
        confirmed,
        projectTicks,
        tombstoneHidesClone,
      },
      sessionPath: opts.keepSession ? sessionPath : undefined,
    },
  }
}
