"use client"

import { Check } from "lucide-react"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { assistantRequestFailed } from "@/lib/assistant-chat-types"
import { useStore } from "@/lib/store"
import type { StructureModel } from "@/lib/types"
import { AssistantChat } from "@/components/assistant-chat"
import { Badge } from "@/components/ui/badge"

type StructureProposal = {
  models: StructureModel[]
}

const STARTERS = [
  "Create structures for PDF legal analysis — source document, atomic rules, compliance assessment",
  "Add tuple[text,quote] fields for verbatim quotes on extracted rules",
  "Add an output model for a final compliance report with pass/fail per rule",
  "Simplify these models — merge redundant fields",
]

export function StructureAssistant() {
  const { project, models, model: globalModel, setModels } = useStore()

  return (
    <AssistantChat<StructureProposal>
      title="Structure assistant"
      subtitle={`${models.length} models · propose → approve or reject`}
      initialMessage="Describe the output structures you need — I'll propose pydantic models you can approve or reject."
      starters={STARTERS}
      placeholder="Describe the structures you want…"
      loadingLabel="designing structures…"
      onApprove={(msg) => {
        if (!msg.proposal) return
        setModels(msg.proposal.models)
      }}
      onReject={() => {}}
      requestAssistant={async (text, history, _opts) => {
        const res = await fetch(API_ROUTES.structureAssistant, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            projectId: project.id,
            message: text,
            history,
            model: globalModel,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? assistantRequestFailed(res.status))
        return {
          message: data.message as string,
          proposal: data.proposal ?? undefined,
        }
      }}
      renderProposal={(m) => (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
              Proposed structures
            </span>
            <Badge variant="outline" className="font-mono text-[9px]">
              {m.proposal!.models.length} models
            </Badge>
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
          <ul className="space-y-2">
            {m.proposal!.models.map((model) => (
              <li key={model.id} className="rounded border border-border/60 bg-background/50 px-2.5 py-2">
                <p className="font-mono text-[11px] text-foreground">{model.name}</p>
                {model.description && (
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground line-clamp-2">
                    {model.description}
                  </p>
                )}
                <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                  {model.fields.length} fields
                  {model.fields.length > 0 && (
                    <>
                      {" · "}
                      {model.fields
                        .slice(0, 4)
                        .map((f) => f.name)
                        .join(", ")}
                      {model.fields.length > 4 ? "…" : ""}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    />
  )
}
