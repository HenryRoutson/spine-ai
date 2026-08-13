// AI : CLI adapter for the in-app project agent (proposePipelineChange + local apply).

import { readFileSync } from "node:fs"
import { createSpineSession } from "@/lib/core/session"
import { createThrowingEgress } from "@/lib/core/transport"
import { toAgentView, toSessionSummary } from "@/lib/core/view"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import type { CliCommandResult } from "@/lib/cli/types"
import { createFilePersist, resolveSessionPath } from "@/lib/cli/session_persist"
import { applyPendingAgent, askAgent } from "@/lib/cli/agent"

export const SPINE_AGENT_HELP = `agent — same propose/apply path as Vibe (LLM remote; apply local)

Usage:
  npx tsx scripts/spine-cli.ts agent ask --message "<prompt>" [--apply] [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts agent apply [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts agent reject [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts agent history [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts agent apply-file --file <proposal.json> [--session <path>] [--json]

--offline  blocks ask (LLM). apply / history / reject stay local.
`

function ok(command: string, data: Record<string, unknown>): CliCommandResult {
  return { ok: true, command, issues: [], data }
}

function usage(message: string): CliCommandResult {
  return {
    ok: false,
    command: "usage",
    issues: [{ level: "error", where: "argv", message }],
    data: { help: SPINE_AGENT_HELP },
  }
}

function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key]
  return typeof v === "string" ? v : undefined
}

function openSession(flags: Record<string, string | boolean>) {
  return createSpineSession({
    persist: createFilePersist(resolveSessionPath(flagString(flags, "session"))),
    egress: flags.offline === true ? createThrowingEgress() : undefined,
  })
}

export async function runAgentCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<CliCommandResult> {
  const sub = positional[1]
  if (!sub || sub === "help") {
    return { ok: true, command: "help", issues: [], data: { help: SPINE_AGENT_HELP } }
  }

  const session = openSession(flags)

  if (sub === "ask") {
    const message = flagString(flags, "message") ?? positional.slice(2).join(" ")
    return askAgent(session, message ?? "", { apply: flags.apply === true || flags.yes === true })
  }

  if (sub === "apply") {
    return applyPendingAgent(session)
  }

  if (sub === "reject") {
    if (!session.pendingProposal) {
      return {
        ok: false,
        command: "agent reject",
        issues: [{ level: "error", where: "agent", message: "no pending proposal" }],
      }
    }
    session.rejectPendingProposal()
    return ok("agent reject", { rejected: true })
  }

  if (sub === "history") {
    const snap = session.getSnapshot()
    return ok("agent history", {
      summary: toSessionSummary(snap),
      agent: toAgentView(snap),
      chat: snap.chat,
    })
  }

  if (sub === "apply-file") {
    const file = flagString(flags, "file") ?? positional[2]
    if (!file) return usage("agent apply-file requires --file <proposal.json>")
    const proposal = JSON.parse(readFileSync(file, "utf8")) as ProjectProposal
    session.setPendingProposal(proposal)
    return applyPendingAgent(session)
  }

  return usage(`unknown agent command: ${sub}`)
}
