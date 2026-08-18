// AI : same propose/apply path as Vibe — LLM is remote; apply is local session mutation.
// AI : TODO (arch-structure-assistant) — askStructureAgent uses proposeStructureChange; GUI structure tab uses full project assistant.
import { DocLabel, InputType } from "@/lib/types"
import type { ModelId, Project } from "@/lib/types"
import type { SpineSession } from "@/lib/core/session"
import { registerAskAgent } from "@/lib/core/actions"
import type { SessionChatTurn } from "@/lib/core/types"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import type { PipelineAssistantProposal, PipelineAssistantResult } from "@/lib/server/pipeline_assistant"
import { proposePipelineChange } from "@/lib/server/pipeline_assistant"
import { proposeStructureChange } from "@/lib/server/structure_assistant"
import { generateTestFile } from "@/lib/server/testing_assistant"
import { diagnoseRunStream } from "@/lib/server/diagnosis_assistant"
import type { CliCommandResult } from "@/lib/cli/types"
import { compactProposalReview } from "@/lib/core/view"
import { mergeDocsByName, mergePendingProposals, overlayProposalOnProject } from "@/lib/project-proposal-overlay"
import type { AssistantTestDocCatalogEntry } from "@/lib/server/assistant-prompt"

export type AgentKind = "vibe" | "structure" | "testing" | "diagnosis"

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
  return proposePipelineChange(project, message, history, model as ModelId, {
    humanSurface: "vibe",
    testDocsCatalog: [],
    recentRuns: [],
  })
}

function changedKeys(proposal: ProjectProposal): string[] {
  return (Object.entries(proposal.changed) as [string, boolean | undefined][])
    .filter(([, v]) => v)
    .map(([k]) => k)
}

const TEST_DOC_PREVIEW_CHARS = 200

function testDocsCatalogFromSession(session: SpineSession): AssistantTestDocCatalogEntry[] {
  const snap = session.getSnapshot()
  const live = snap.docs
    .filter((d) => d.label === DocLabel.Inference)
    .map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      label: d.label,
      sizeKb: d.sizeKb,
      preview: (d.preview ?? snap.docContents[d.id] ?? "").slice(0, TEST_DOC_PREVIEW_CHARS),
    }))
  const pending = (snap.pendingProposal?.docs ?? []).map((d) => ({
    id: `pending:${d.name}`,
    name: d.name,
    type: d.type,
    label: d.label,
    sizeKb: Math.max(1, Math.ceil((d.content?.length ?? 0) / 1024)),
    preview: (d.content ?? "").slice(0, TEST_DOC_PREVIEW_CHARS),
  }))
  return mergeDocsByName(live, pending)
}

export async function askAgent(
  session: SpineSession,
  message: string,
  opts: { apply?: boolean; run?: boolean; kind?: AgentKind; propose?: AgentProposeFn } = {},
): Promise<CliCommandResult> {
  const kind = opts.kind ?? "vibe"
  if (kind === "structure") return askStructureAgent(session, message, opts)
  if (kind === "testing") return askTestingAgent(session, message, opts)
  if (kind === "diagnosis") return askDiagnosisAgent(session, message)
  return askVibeAgent(session, message, opts)
}

async function askVibeAgent(
  session: SpineSession,
  message: string,
  opts: { apply?: boolean; run?: boolean; propose?: AgentProposeFn },
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
  if (session.egress?.blocked) {
    return {
      ok: false,
      command: "agent ask",
      issues: [{ level: "error", where: "agent", message: "agent is remote (LLM); --offline blocks it" }],
    }
  }

  const history = session.chat
  session.appendChat({ role: "user", content: trimmed })
  try {
    const live = session.project
    if (!live) {
      return {
        ok: false,
        command: "agent ask",
        issues: [{ level: "error", where: "session", message: "no active project — session add-project first" }],
      }
    }
    const propose =
      opts.propose ??
      ((project, message, history, model) =>
        proposePipelineChange(project, message, history, model as ModelId, {
          humanSurface: "vibe",
          testDocsCatalog: testDocsCatalogFromSession(session),
          recentRuns: [],
        }))
    const prevPending = session.pendingProposal
    const result = await propose(
      overlayProposalOnProject(live, prevPending),
      trimmed,
      history,
      session.model,
    )
    const stillInvalid = (result.invalidCount ?? 0) > 0
    session.appendChat({ role: "assistant", content: result.message })
    const proposal = result.proposal ? toProjectProposal(result.proposal) : null
    const actions = proposal?.proposedActions ?? []
    const merged = proposal ? mergePendingProposals(prevPending, proposal) : null
    if (merged) {
      session.setPendingProposal(merged)
      if (opts.apply) session.applyPendingProposal()
    }
    let ran = 0
    if (opts.apply && opts.run && actions.length) {
      ran = (await session.executeProposedActions(actions)).length
    }
    return {
      ok: true,
      command: "agent ask",
      issues: stillInvalid
        ? [{ level: "error", where: "proposal", message: result.validationErrors ?? "proposal still invalid" }]
        : [],
      data: {
        message: result.message,
        applied: Boolean(opts.apply && merged),
        pending: Boolean(session.pendingProposal),
        changed: merged ? changedKeys(merged) : [],
        proposedActions: actions.map((a) => a.type),
        ran,
        invalidCount: result.invalidCount,
        validationErrors: result.validationErrors,
        usageCents: result.usageCents,
        proposal: merged ? compactProposalReview(merged) : null,
        human: [
          result.message,
          merged ? `changed: ${changedKeys(merged).join(", ") || "(none)"}` : "no proposal",
          stillInvalid ? "still invalid — not ready to apply" : "",
          opts.apply ? "applied" : merged ? "pending — spine agent apply" : "",
          actions.length
            ? opts.run
              ? `proposedActions ran: ${actions.map((a) => a.type).join(", ")}`
              : `proposedActions (pass --run to execute): ${actions.map((a) => a.type).join(", ")}`
            : "",
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

export async function askStructureAgent(
  session: SpineSession,
  message: string,
  opts: { apply?: boolean } = {},
): Promise<CliCommandResult> {
  const blocked = requireAgentReady(session, message, "agent structure")
  if (blocked) return blocked
  session.appendChat({ role: "user", content: message.trim() })
  try {
    const result = await proposeStructureChange(session.project!, message.trim(), session.chat, session.model as ModelId)
    session.appendChat({ role: "assistant", content: result.message })
    if (result.proposal && opts.apply) session.applyProjectChanges({ models: result.proposal.models })
    return {
      ok: true,
      command: "agent structure",
      issues: [],
      data: {
        message: result.message,
        applied: Boolean(opts.apply && result.proposal),
        models: result.proposal?.models.map((m) => m.name) ?? [],
        human: result.message,
      },
    }
  } catch (err) {
    return agentFail("agent structure", session, err)
  }
}

export async function askTestingAgent(
  session: SpineSession,
  message: string,
  opts: { apply?: boolean } = {},
): Promise<CliCommandResult> {
  const blocked = requireAgentReady(session, message, "agent testing")
  if (blocked) return blocked
  session.appendChat({ role: "user", content: message.trim() })
  try {
    const generated = await generateTestFile(
      session.project!,
      session.docs,
      message.trim(),
      session.model as ModelId,
    )
    if (opts.apply !== false) {
      session.addDocContent({
        name: generated.name,
        type: InputType.Text,
        content: generated.content,
        label: DocLabel.Inference,
      })
    }
    session.appendChat({ role: "assistant", content: `wrote ${generated.name}` })
    return {
      ok: generated.issues.length === 0,
      command: "agent testing",
      issues: generated.issues.map((i) => ({ level: i.level, where: generated.name, message: i.message })),
      data: { name: generated.name, content: generated.content, usageCents: generated.usageCents },
    }
  } catch (err) {
    return agentFail("agent testing", session, err)
  }
}

export async function askDiagnosisAgent(session: SpineSession, message: string): Promise<CliCommandResult> {
  const blocked = requireAgentReady(session, message, "agent diagnose")
  if (blocked) return blocked
  const run = session.runs[session.runs.length - 1]
  if (!run) {
    return {
      ok: false,
      command: "agent diagnose",
      issues: [{ level: "error", where: "agent", message: "no local run — session start-run or pull first" }],
    }
  }
  session.appendChat({ role: "user", content: message.trim() })
  try {
    const result = await diagnoseRunStream(session.project!, run, message.trim(), session.model as ModelId, () => undefined)
    session.appendChat({ role: "assistant", content: result.text })
    return {
      ok: true,
      command: "agent diagnose",
      issues: [],
      data: { message: result.text, usageCents: result.usageCents, runId: run.id, human: result.text },
    }
  } catch (err) {
    return agentFail("agent diagnose", session, err)
  }
}

function requireAgentReady(session: SpineSession, message: string, command: string): CliCommandResult | null {
  if (!message.trim()) {
    return { ok: false, command, issues: [{ level: "error", where: "argv", message: `${command} requires --message` }] }
  }
  if (!session.project) {
    return { ok: false, command, issues: [{ level: "error", where: "session", message: "no active project" }] }
  }
  if (session.egress?.blocked) {
    return {
      ok: false,
      command,
      issues: [{ level: "error", where: "agent", message: "agent is remote (LLM); --offline blocks it" }],
    }
  }
  return null
}

function agentFail(command: string, session: SpineSession, err: unknown): CliCommandResult {
  const msg = (err as Error).message || "agent failed"
  session.appendChat({ role: "assistant", content: `Agent failed: ${msg}` })
  return { ok: false, command, issues: [{ level: "error", where: "agent", message: msg }] }
}

export async function applyPendingAgent(
  session: SpineSession,
  opts: { run?: boolean } = {},
): Promise<CliCommandResult> {
  const pending = session.pendingProposal
  if (!pending) {
    return {
      ok: false,
      command: "agent apply",
      issues: [{ level: "error", where: "agent", message: "no pending proposal" }],
    }
  }
  const changed = changedKeys(pending)
  const actions = pending.proposedActions ?? []
  session.applyPendingProposal()
  let ran = 0
  if (opts.run && actions.length) {
    ran = (await session.executeProposedActions(actions)).length
  }
  return {
    ok: true,
    command: "agent apply",
    issues: [],
    data: {
      applied: true,
      changed,
      proposedActions: actions.map((a) => a.type),
      ran,
      human: [
        `applied: ${changed.join(", ") || "(none)"}`,
        actions.length
          ? opts.run
            ? `proposedActions ran: ${actions.map((a) => a.type).join(", ")}`
            : `proposedActions (pass --run to execute): ${actions.map((a) => a.type).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  }
}

registerAskAgent((session, message) => askAgent(session, message))
