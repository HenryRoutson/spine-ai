"use client"

import { StickyNote } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

export function RunNotesPad({
  value,
  onChange,
  hint,
  placeholder = "What changed, what you're checking, expected vs actual…",
}: {
  value: string
  onChange: (v: string) => void
  hint?: string
  placeholder?: string
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          run notes
        </span>
        {hint && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">{hint}</span>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0"
      />
    </div>
  )
}
