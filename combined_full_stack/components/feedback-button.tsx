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
import { formatCents } from "@/lib/format"
import { useWorkspaceBilling } from "@/lib/use-workspace-billing"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"

type FeedbackResponse = {
  error?: string
  code?: string
  creditedCents?: number
  creditsRemainingToday?: number
}

export function FeedbackButton() {
  const { billingAccount, refreshBilling } = useWorkspaceBilling()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [creditNote, setCreditNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const minChars = billingAccount?.feedbackMinChars ?? 100
  const creditCents = billingAccount?.feedbackCreditCents ?? 100
  const maxPerDay = billingAccount?.feedbackMaxCreditsPerDay ?? 10
  const trimmedLen = message.trim().length
  const canSubmit = trimmedLen >= minChars && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    setCreditNote(null)
    try {
      const res = await fetch(API_ROUTES.feedback, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      })
      const data = (await res.json()) as FeedbackResponse
      if (!res.ok) throw new Error(data.error ?? "Failed to send feedback")
      setMessage("")
      setSent(true)
      if (data.creditedCents && data.creditedCents > 0) {
        setCreditNote(`+${formatCents(data.creditedCents)} credit`)
        void refreshBilling()
      } else if (data.creditsRemainingToday === 0) {
        setCreditNote("Thanks — daily credit limit reached")
      }
      setTimeout(() => {
        setSent(false)
        setCreditNote(null)
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
        <span className="hidden sm:inline">
          {sent ? (creditNote ?? "Thanks") : "Feedback"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          send feedback
        </p>
        <p className="mb-2 font-mono text-[10px] text-muted-foreground">
          Earn {formatCents(creditCents)} credit · min {minChars} chars · up to {maxPerDay}/day
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
            placeholder="Bugs, ideas, what's confusing…"
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
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {trimmedLen}/{minChars} chars
        </p>
        {error && (
          <p className="mt-2 font-mono text-[10px] text-destructive">{error}</p>
        )}
        <Button
          size="sm"
          className="mt-2 w-full"
          onClick={() => void submit()}
          disabled={!canSubmit}
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Send
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
