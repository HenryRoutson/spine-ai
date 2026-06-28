"use client"

import { Check, AlertTriangle, FileText } from "lucide-react"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { readPipelineAssistantStream } from "@/lib/assistant-stream-read"
import { assistantRequestFailed } from "@/lib/assistant-chat-types"
import { useStore } from "@/lib/store"
import { MODULE_META } from "@/lib/types"
import { AssistantChat, type AssistantChatMessage } from "@/components/assistant-chat"
import { Badge } from "@/components/ui/badge"
import { useProjectAssistant } from "@/lib/project-assistant-context"
import {
  PROJECT_ASSISTANT_INITIAL_MESSAGE,
  PROJECT_ASSISTANT_STARTERS,
  type ProjectProposal,
} from "@/lib/project-assistant-types"
import { cn } from "@/lib/utils"

type ProjectAssistantProps = {
  className?: string
}

export function ProjectAssistant({ className }: ProjectAssistantProps) {
  const {
    project,
    modules,
    models,
    docs,
    model: globalModel,
    addDocContent,
    applyProjectChanges,
    refresh,
    refreshBilling,
  } = useStore()
  const { getSession } = useProjectAssistant()
  const { messages, setMessages } = getSession(project.id, PROJECT_ASSISTANT_INITIAL_MESSAGE)

  async function applyProposal(proposal: ProjectProposal) {
    if (proposal.changed.models || proposal.changed.modules) {
      applyProjectChanges({
        ...(proposal.changed.models ? { models: proposal.models } : {}),
        ...(proposal.changed.modules ? { modules: proposal.modules } : {}),
      })
    }
    if (proposal.changed.docs) {
      for (const spec of proposal.docs) {
        await addDocContent(spec.name, spec.type, spec.content, spec.label, project.id)
      }
    }
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <AssistantChat<ProjectProposal>
        title="Project assistant"
        subtitle={`${modules.length} steps · ${models.length} models · ${docs.length} docs`}
        showDebug
        initialMessage={PROJECT_ASSISTANT_INITIAL_MESSAGE}
        starters={PROJECT_ASSISTANT_STARTERS}
        placeholder="Describe structures, pipeline, and test documents…"
        loadingLabel={(phase) =>
          phase === "retrying"
            ? "retrying…"
            : phase === "structuring"
              ? "designing project…"
              : "thinking…"
        }
        messages={messages}
        onMessagesChange={setMessages}
        onApprove={async (msg) => {
          if (!msg.proposal) return
          await applyProposal(msg.proposal)
        }}
        onReject={() => {}}
        requestAssistant={async (text, history, { setLoadingPhase, onThinkingDelta, onDebugEntry }) => {
          const res = await fetch(API_ROUTES.projectAssistant, {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              projectId: project.id,
              message: text,
              history,
              model: globalModel,
              stream: true,
            }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(
              (data as { error?: string }).error ?? assistantRequestFailed(res.status),
            )
          }
          const data = await readPipelineAssistantStream<ProjectProposal>(res, {
            onThinkingDelta,
            onPhase: setLoadingPhase,
            onDebugEntry,
          })
          if ((data.billedCents ?? 0) > 0) {
            void refreshBilling()
            void refresh()
          }
          if (data.proposal) {
            data.proposal = {
              ...data.proposal,
              docs: data.proposal.docs ?? [],
              changed: data.proposal.changed ?? {
                modules: true,
                models: true,
                docs: (data.proposal.docs?.length ?? 0) > 0,
              },
            }
          }
          return data
        }}
        renderProposal={(m) => <ProjectProposalPreview msg={m} />}
      />
    </div>
  )
}

function ProjectProposalPreview({ msg }: { msg: AssistantChatMessage<ProjectProposal> }) {
  const p = msg.proposal!
  const showModels = p.changed?.models ?? true
  const showModules = p.changed?.modules ?? true
  const showDocs = p.changed?.docs ?? (p.docs?.length ?? 0) > 0

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
          Proposed changes
        </span>
        {showModules && (
          <Badge variant="outline" className="font-mono text-[9px]">
            {p.modules.length} steps
          </Badge>
        )}
        {showModels && (
          <Badge variant="outline" className="font-mono text-[9px]">
            {p.models.length} models
          </Badge>
        )}
        {showDocs && (
          <Badge variant="outline" className="font-mono text-[9px]">
            {p.docs.length} docs
          </Badge>
        )}
        {msg.retryCount != null && msg.retryCount > 0 && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            retried {msg.retryCount}×
          </Badge>
        )}
        {msg.invalidCount != null && msg.invalidCount > 0 && (
          <Badge
            variant="outline"
            className="gap-1 border-destructive/50 font-mono text-[9px] text-destructive"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {msg.invalidCount} invalid
          </Badge>
        )}
        {msg.status === "approved" && (
          <Badge className="gap-1 font-mono text-[9px]">
            <Check className="h-3.5 w-3.5" /> applied
          </Badge>
        )}
        {msg.status === "rejected" && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            rejected
          </Badge>
        )}
      </div>

      {msg.validationErrors && (
        <pre className="mb-2 max-h-24 overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[9px] leading-relaxed whitespace-pre-wrap text-destructive">
          {msg.validationErrors}
        </pre>
      )}

      {showModels && (
        <div className="mb-3">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Structures
          </p>
          <ul className="space-y-1">
            {p.models.map((model) => (
              <li
                key={model.id}
                className="rounded border border-border/60 bg-background/50 px-2 py-1.5 font-mono text-[10px]"
              >
                <span className="text-foreground">{model.name}</span>
                <span className="text-muted-foreground"> · {model.fields.length} fields</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showModules && (
        <div className="mb-3">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Pipeline
          </p>
          <ol className="space-y-1">
            {p.modules.map((step, i) => (
              <li
                key={step.id}
                className="flex items-baseline gap-2 font-mono text-[10px] text-muted-foreground"
              >
                <span className="text-foreground/50">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-foreground">{step.label}</span>
                <span>· {MODULE_META[step.kind].label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {showDocs && p.docs.length > 0 && (
        <div>
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Test documents
          </p>
          <ul className="space-y-1">
            {p.docs.map((doc) => (
              <li
                key={doc.name}
                className="flex items-center gap-2 rounded border border-border/60 bg-background/50 px-2 py-1.5 font-mono text-[10px]"
              >
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-foreground">{doc.name}</span>
                <span className="text-muted-foreground">
                  · {doc.label} · {Math.round(doc.content.length / 1024)}kb
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
