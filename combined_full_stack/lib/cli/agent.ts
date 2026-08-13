// AI : same propose/apply path as Vibe — LLM is remote; apply is local session mutation.

import { DocLabel } from "@/lib/types"
import type { ModelId, Project } from "@/lib/types"
import type { SpineSession } from "@/lib/core/session"
import type { SessionChatTurn } from "@/lib/core/types"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import type { PipelineAssistantProposal, PipelineAssistantResult } from "@/lib/server/pipeline_assistant"
import { proposePipelineChange } from "@/lib/server/pipeline_assistant"
import type { CliCommandResult } from "@/lib/cli/types"

export type AgentProposeFn = (
  project: Project,
  message: string,
  history: SessionChatTurn[],
  model: string,
) => Promise<PipelineAssistantResult>

export function toProjectProposal(proposal: PipelineAssistantProposal): ProjectProposal {
  return {
    modules: proposal.modules,
    models: proposal.models,
    typeAliases: proposal.typeAliases,
    docs: proposal.docs.map((d) => ({
      name: d.name,
      type: d.type,
      content: d.content,
      label: d.label ?? DocLabel.Inference,
    })),
    documentation: proposal.documentation,
    projectName: proposal.projectName,
    proposedActions: proposal.proposedActions,
    changed: proposal.changed,
  }
}

export async function defaultAgentPropose(
  project: Project,
  message: string,
  history: SessionChatTurn[],
  model: string,
): Promise<PipelineAssistantResult> {
  // AI : TODO (cli-parity vs Vibe) — React also passes store (observe tools), testDocsCatalog,
  // AI :   recentRuns / lastFailedRun, uiContext, streaming onThinkingDelta / onMessageDelta, billing ledger.
  return proposePipelineChange(project, message, history, model as ModelId, { humanSurface: "vibe" })
}

function changedKeys(proposal: ProjectProposal): string[] {
  return (Object.entries(proposal.changed) as [string, boolean | undefined][])
    .filter(([, v]) => v)
    .map(([k]) => k)
}

export async function askAgent(
  session: SpineSession,
  message: string,
  opts: { apply?: boolean; propose?: AgentProposeFn } = {},
): Promise<CliCommandResult> {
  const trimmed = message.trim()
  if (!trimmed) {
    return {
      ok: false,
      command: "agent ask",
      issues: [{ level: "error", where: "argv", message: "agent ask requires --message" }],
    }
  }
  if (!session.project) {
    return {
      ok: false,
      command: "agent ask",
      issues: [{ level: "error", where: "session", message: "no active project — session add-project first" }],
    }
  }
  if (session.egress) {
    return {
      ok: false,
      command: "agent ask",
      issues: [{ level: "error", where: "agent", message: "agent is remote (LLM); --offline blocks it" }],
    }
  }

  const history = session.chat
  session.appendChat({ role: "user", content: trimmed })
  try {
    const propose = opts.propose ?? defaultAgentPropose
    const result = await propose(session.project, trimmed, history, session.model)
    session.appendChat({ role: "assistant", content: result.message })
    const proposal = result.proposal ? toProjectProposal(result.proposal) : null
    if (proposal) {
      session.setPendingProposal(proposal)
      if (opts.apply) session.applyPendingProposal()
    }
    const actions = proposal?.proposedActions?.map((a) => a.type) ?? []
    // AI : TODO (cli-parity) — React runAssistantInference / run_test after approve; CLI only records the names.
    return {
      ok: true,
      command: "agent ask",
      issues: [],
      data: {
        message: result.message,
        applied: Boolean(opts.apply && proposal),
        pending: Boolean(session.pendingProposal),
        changed: proposal ? changedKeys(proposal) : [],
        proposedActions: actions,
        invalidCount: result.invalidCount,
        usageCents: result.usageCents,
        human: [
          result.message,
          proposal
            ? `changed: ${changedKeys(proposal).join(", ") || "(none)"}`
            : "no proposal",
          opts.apply
            ? "applied"
            : proposal
              ? "pending — spine agent apply"
              : "",
          actions.length ? `proposedActions (not run locally): ${actions.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    }
  } catch (err) {
    const msg = (err as Error).message || "agent failed"
    session.appendChat({ role: "assistant", content: `Agent failed: ${msg}` })
    return {
      ok: false,
      command: "agent ask",
      issues: [{ level: "error", where: "agent", message: msg }],
    }
  }
}

export function applyPendingAgent(session: SpineSession): CliCommandResult {
  const pending = session.pendingProposal
  if (!pending) {
    return {
      ok: false,
      command: "agent apply",
      issues: [{ level: "error", where: "agent", message: "no pending proposal" }],
    }
  }
  const changed = changedKeys(pending)
  const actions = pending.proposedActions?.map((a) => a.type) ?? []
  session.applyPendingProposal()
  return {
    ok: true,
    command: "agent apply",
    issues: [],
    data: {
      applied: true,
      changed,
      proposedActions: actions,
      human: [
        `applied: ${changed.join(", ") || "(none)"}`,
        actions.length ? `proposedActions (not run locally): ${actions.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  }
}
