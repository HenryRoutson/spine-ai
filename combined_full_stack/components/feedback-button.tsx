"use client"

import { useState } from "react"
import { Check, Loader2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { API_ROUTES } from "@/lib/api-routes"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = message.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(API_ROUTES.feedback, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to send feedback")
      setMessage("")
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setOpen(false)
      }, COPY_FEEDBACK_MS)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:bg-accent"
        title="Send feedback"
      >
        {sent ? (
          <Check className="h-3.5 w-3.5 text-primary" />
        ) : (
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="hidden sm:inline">{sent ? "Thanks" : "Feedback"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          send feedback
        </p>
        <div
          // AI : menu items steal focus / typeahead on pointer + keyboard — block both.
          onPointerDown={(e) => e.preventDefault()}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onKeyUpCapture={(e) => e.stopPropagation()}
        >
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Bugs, ideas, what’s confusing…"
            className="min-h-24 resize-y font-mono text-xs"
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void submit()
              }
            }}
          />
        </div>
        {error && (
          <p className="mt-2 font-mono text-[10px] text-destructive">{error}</p>
        )}
        <Button
          size="sm"
          className="mt-2 w-full"
          onClick={() => void submit()}
          disabled={busy || !message.trim()}
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Send
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
