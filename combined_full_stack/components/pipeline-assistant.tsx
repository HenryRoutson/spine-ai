"use client"

import { Check, AlertTriangle } from "lucide-react"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { readPipelineAssistantStream } from "@/lib/assistant-stream-read"
import { assistantRequestFailed } from "@/lib/assistant-chat-types"
import { useStore } from "@/lib/store"
import type { PipelineModule, StructureModel } from "@/lib/types"
import { MODULE_META } from "@/lib/types"
import { AssistantChat } from "@/components/assistant-chat"
import { Badge } from "@/components/ui/badge"

type PipelineProposal = {
  modules: PipelineModule[]
  models: StructureModel[]
}

const STARTERS = [
  "Build a pipeline to take in GPS site locations, profile their locations, and evaluate similarities — e.g. Russian sites, research labs, cold locations",
  "Build a pipeline from scratch for PDF legal doc analysis",
  "Add a Link Quotes step after the LLM extraction",
  "Simplify this pipeline — remove unnecessary steps",
]

export function PipelineAssistant() {
  const { project, modules, models, model: globalModel, setModules, setModels } = useStore()

  return (
    <AssistantChat<PipelineProposal>
      title="Pipeline assistant"
      subtitle={`${modules.length} steps · ${models.length} models · propose → approve or reject`}
      showDebug
      initialMessage="Describe the pipeline you want — I'll propose steps you can approve or reject. Reference your structure models by name."
      starters={STARTERS}
      placeholder="Describe the pipeline you want…"
      loadingLabel={(phase) =>
        phase === "retrying"
          ? "retrying…"
          : phase === "structuring"
            ? "designing pipeline…"
            : "thinking…"
      }
      onApprove={(msg) => {
        if (!msg.proposal) return
        setModels(msg.proposal.models)
        setModules(msg.proposal.modules)
      }}
      onReject={() => {}}
      requestAssistant={async (text, history, { setLoadingPhase, onThinkingDelta, onDebugEntry }) => {
        const res = await fetch(API_ROUTES.pipelineAssistant, {
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
          const data = await res.json()
          throw new Error(data.error ?? assistantRequestFailed(res.status))
        }
        return readPipelineAssistantStream<PipelineProposal>(res, {
          onThinkingDelta,
          onPhase: setLoadingPhase,
          onDebugEntry,
        })
      }}
      renderProposal={(m) => (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
              Proposed pipeline
            </span>
            <Badge variant="outline" className="font-mono text-[9px]">
              {m.proposal!.modules.length} steps
            </Badge>
            {m.retryCount != null && m.retryCount > 0 && (
              <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                retried {m.retryCount}×
              </Badge>
            )}
            {m.invalidCount != null && m.invalidCount > 0 && (
              <Badge
                variant="outline"
                className="gap-1 border-destructive/50 font-mono text-[9px] text-destructive"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {m.invalidCount} invalid
              </Badge>
            )}
            {m.status === "approved" && (
              <Badge className="gap-1 font-mono text-[9px]">
                <Check className="h-2.5 w-2.5" /> applied
              </Badge>
            )}
            {m.status === "rejected" && (
              <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                rejected
              </Badge>
            )}
          </div>
          {m.validationErrors && (
            <pre className="mb-2 max-h-24 overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[9px] leading-relaxed whitespace-pre-wrap text-destructive">
              {m.validationErrors}
            </pre>
          )}
          <ol className="space-y-1">
            {m.proposal!.modules.map((step, i) => (
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
        </>
      )}
    />
  )
}
