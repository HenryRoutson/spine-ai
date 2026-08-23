// AI : CLI adapter for the four in-app assistants (vibe, structure, testing, diagnosis).
// AI : DONE (arch-cli-result) — ok / usage come from cli/types (cliOk / cliUsage).

import { readFileSync } from "node:fs"
import { toAgentView, toSessionSummary } from "@/lib/core/view"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import { cliOk as ok, cliUsage, flagString, type CliCommandResult } from "@/lib/cli/types"
import { openCliSession } from "@/lib/cli/session_open"
import { applyPendingAgent, askAgent, type AgentKind } from "@/lib/cli/agent"

export const SPINE_AGENT_HELP = `agent — same propose/apply path as Vibe (LLM remote; apply local)

Usage:
  spine agent ask --message "<prompt>" [--assistant vibe|structure|testing|diagnosis] [--apply] [--run]
  spine agent structure --message "<prompt>" [--apply]
  spine agent testing --message "<prompt>" [--apply]
  spine agent diagnose --message "<prompt>"
  spine agent apply [--run]
  spine agent reject
  spine agent history
  spine agent apply-file --file <proposal.json> [--run]

--offline  blocks ask (LLM). apply / history / reject stay local.
--run      after apply, execute proposedActions (startRun / runTest via SPINE_API_URL)
`

function usage(message: string): CliCommandResult {
  return cliUsage(message, SPINE_AGENT_HELP)
}

function parseKind(raw?: string): AgentKind {
  if (raw === "structure" || raw === "testing" || raw === "diagnosis" || raw === "vibe") return raw
  return "vibe"
}

function openSession(flags: Record<string, string | boolean>) {
  return openCliSession(flags)
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
  const run = flags.run === true

  if (sub === "ask") {
    const message = flagString(flags, "message") ?? positional.slice(2).join(" ")
    return askAgent(session, message ?? "", {
      apply: flags.apply === true || flags.yes === true,
      run,
      kind: parseKind(flagString(flags, "assistant") ?? flagString(flags, "kind")),
    })
  }

  if (sub === "structure" || sub === "testing" || sub === "diagnose" || sub === "diagnosis") {
    const message = flagString(flags, "message") ?? positional.slice(2).join(" ")
    const kind: AgentKind = sub === "diagnose" || sub === "diagnosis" ? "diagnosis" : sub
    return askAgent(session, message ?? "", {
      apply: flags.apply === true || flags.yes === true,
      run,
      kind,
    })
  }

  if (sub === "apply") {
    return applyPendingAgent(session, { run })
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
    return applyPendingAgent(session, { run })
  }

  return usage(`unknown agent command: ${sub}`)
}
