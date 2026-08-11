"use client"

import { Input } from "@/components/ui/input"
import { ModelSelector } from "@/components/model-selector"
import { DEFAULT_CHATBOT_MAX_TURNS } from "@/lib/chatbot-step"
import { ChatbotMode, type PipelineModule } from "@/lib/types"
import { PipelineField, StaticValue, llmModelLabel } from "@/components/pipeline-fields/shared"

type ChatbotModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  globalModel?: string
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function ChatbotModuleFields({ selected, edit, globalModel, onUpdate }: ChatbotModuleFieldsProps) {
  const mode = selected.chatbotMode ?? ChatbotMode.UntilExit

  return (
    <>
      <PipelineField
        label="I/O structures"
        hint="Locked — upstream must emit ChatbotPrompt; this step emits ChatbotResult"
      >
        <StaticValue mono>ChatbotPrompt → ChatbotResult</StaticValue>
      </PipelineField>

      <PipelineField label="Mode" hint="single = one exchange then done; until-exit = chat until Exit">
        {edit ? (
          <select
            value={mode}
            onChange={(e) => onUpdate!({ chatbotMode: e.target.value as ChatbotMode })}
            className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
          >
            <option value={ChatbotMode.UntilExit}>Until Exit</option>
            <option value={ChatbotMode.Single}>Single response</option>
          </select>
        ) : (
          <StaticValue mono>{mode === ChatbotMode.Single ? "single" : "until-exit"}</StaticValue>
        )}
      </PipelineField>

      <PipelineField label="Model">
        {edit ? (
          <ModelSelector
            value={selected.model ?? globalModel ?? ""}
            onChange={(v) => onUpdate!({ model: v })}
          />
        ) : (
          <StaticValue mono>{llmModelLabel(selected.model)}</StaticValue>
        )}
      </PipelineField>

      <PipelineField label="Max turns" hint={`cap for until-exit (default ${DEFAULT_CHATBOT_MAX_TURNS})`}>
        {edit ? (
          <Input
            type="number"
            min={1}
            max={200}
            value={selected.maxTurns ?? DEFAULT_CHATBOT_MAX_TURNS}
            onChange={(e) => {
              const n = Number(e.target.value)
              onUpdate!({ maxTurns: Number.isFinite(n) ? n : undefined })
            }}
            className="h-8 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.maxTurns ?? DEFAULT_CHATBOT_MAX_TURNS}</StaticValue>
        )}
      </PipelineField>
    </>
  )
}
