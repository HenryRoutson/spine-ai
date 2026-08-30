"use client"

import { Check } from "lucide-react"
import {
  AGENT_CHAT_UI_KIT_META,
  AGENT_CHAT_UI_KITS,
  type AgentChatUiKit,
  useAgentChatUiKit,
  writeAgentChatUiKit,
} from "@/lib/agent-chat-ui-settings"
import { cn } from "@/lib/utils"

export function AgentChatUiSwitcher({ compact = false }: { compact?: boolean }) {
  const kit = useAgentChatUiKit()
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-border bg-background p-0.5",
        compact ? "gap-0" : "gap-0.5",
      )}
      role="radiogroup"
      aria-label="Agent chat UI"
    >
      {AGENT_CHAT_UI_KITS.map((id) => {
        const meta = AGENT_CHAT_UI_KIT_META[id]
        const active = kit === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            title={meta.description}
            onClick={() => writeAgentChatUiKit(id)}
            className={cn(
              "rounded px-1.5 font-mono text-[9px] leading-5 transition-colors",
              active
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {compact ? meta.shortLabel : meta.label}
            {active && !compact ? <Check className="ml-1 inline h-2.5 w-2.5" /> : null}
          </button>
        )
      })}
    </div>
  )
}

export function AgentChatUiKitLabel({ kit }: { kit: AgentChatUiKit }) {
  return (
    <span className="font-mono text-[9px] text-muted-foreground">{AGENT_CHAT_UI_KIT_META[kit].label}</span>
  )
}
