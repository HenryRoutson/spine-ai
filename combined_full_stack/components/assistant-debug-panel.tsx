"use client"

import { useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import type { AssistantDebugEntry } from "@/lib/assistant-chat-types"
import { formatAssistantDebugTrace } from "@/lib/assistant-debug"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"

function DebugEntryRow({ entry }: { entry: AssistantDebugEntry }) {
  switch (entry.kind) {
    case "phase":
      return (
        <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
          {entry.phase}
        </p>
      )
    case "thinking":
      return (
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Thinking
          </p>
          <p className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {entry.text}
          </p>
        </div>
      )
    case "llm_response":
      return (
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            LLM response · {entry.label}
          </p>
          <pre className="max-h-48 overflow-auto rounded border border-border/60 bg-background/80 p-2 font-mono text-[9px] leading-relaxed whitespace-pre-wrap text-foreground/90">
            {JSON.stringify(entry.response, null, 2)}
          </pre>
        </div>
      )
    case "structured_failure":
      return (
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-destructive">
            Structured failure · attempt {entry.attempt} · {entry.failureKind}
          </p>
          <pre className="max-h-32 overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[9px] leading-relaxed whitespace-pre-wrap text-destructive">
            {entry.error}
          </pre>
        </div>
      )
    case "validation_failed":
      return (
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Validation failed · retry {entry.attempt}
          </p>
          <pre className="max-h-32 overflow-auto rounded border border-amber-500/30 bg-amber-500/5 p-2 font-mono text-[9px] leading-relaxed whitespace-pre-wrap text-amber-800 dark:text-amber-200">
            {entry.errors}
          </pre>
        </div>
      )
    case "done":
      return (
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Done · {entry.retryCount} retries · {entry.invalidCount} invalid
          </p>
          {entry.validationErrors && (
            <pre className="mb-2 max-h-24 overflow-auto rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[9px] text-destructive">
              {entry.validationErrors}
            </pre>
          )}
        </div>
      )
    case "error":
      return (
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-destructive">Error</p>
          <p className="font-mono text-[10px] text-destructive">{entry.error}</p>
        </div>
      )
  }
}

type AssistantDebugPanelProps = {
  entries: AssistantDebugEntry[]
  liveThinking?: string
  thinkingActive?: boolean
  className?: string
}

export function AssistantDebugPanel({
  entries,
  liveThinking,
  thinkingActive = false,
  className,
}: AssistantDebugPanelProps) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showLiveThinking = thinkingActive && Boolean(liveThinking)

  async function copyAll() {
    const entriesForCopy =
      showLiveThinking && liveThinking
        ? [
            ...entries.filter((e) => e.kind !== "thinking"),
            { kind: "thinking" as const, text: liveThinking },
          ]
        : entries
    await navigator.clipboard.writeText(formatAssistantDebugTrace(entriesForCopy))
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  if (entries.length === 0 && !showLiveThinking) return null

  return (
    <div className={cn("rounded-lg border border-border/60 bg-secondary/20 px-3 py-2", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Debug trace</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 font-mono text-[9px]"
          onClick={() => void copyAll()}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy all"}
        </Button>
      </div>
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {showLiveThinking && (
          <div>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Thinking
            </p>
            <p className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {liveThinking}
              {thinkingActive && (
                <span className="inline-block animate-pulse text-primary">▍</span>
              )}
            </p>
          </div>
        )}
        {entries.map((entry, i) => (
          <DebugEntryRow key={`${entry.kind}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  )
}
