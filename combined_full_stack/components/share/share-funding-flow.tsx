"use client"

import { ArrowRight, CircleDollarSign } from "lucide-react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type ShareFundingChoice = {
  value: string
  label: string
  senderPays: boolean
  description?: string
}

export function ShareFundingDiagram({
  senderLabel,
  receiverLabel,
  senderPays,
}: {
  senderLabel: string
  receiverLabel: string
  senderPays: boolean
}) {
  return (
    <div
      className="flex items-center justify-center gap-3 rounded-md border border-border bg-muted/15 px-4 py-3"
      aria-label={
        senderPays
          ? `${senderLabel} pays for runs sent to ${receiverLabel}`
          : `${receiverLabel} pays for runs from ${senderLabel}`
      }
    >
      <FundingParty label={senderLabel} pays={senderPays} />
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <FundingParty label={receiverLabel} pays={!senderPays} />
    </div>
  )
}

function FundingParty({ label, pays }: { label: string; pays: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-[5.5rem] flex-col items-center gap-1 rounded-md border px-3 py-2 text-center transition-colors",
        pays
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      {pays ? (
        <CircleDollarSign className="h-4 w-4 text-primary" aria-hidden />
      ) : (
        <span className="h-4" aria-hidden />
      )}
      <span className="text-xs font-medium">{label}</span>
      {pays && (
        <span className="font-mono text-[9px] uppercase tracking-wider text-primary">pays</span>
      )}
    </div>
  )
}

export function ShareFundingPicker({
  value,
  onChange,
  senderLabel,
  receiverLabel,
  options,
}: {
  value: string
  onChange: (value: string) => void
  senderLabel: string
  receiverLabel: string
  options: ShareFundingChoice[]
}) {
  const selected = options.find((o) => o.value === value) ?? options[0]

  return (
    <div className="space-y-2">
      <Label className="font-mono text-[10px] uppercase tracking-wider">Who pays</Label>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              "flex w-full flex-col rounded-md border px-3 py-2 text-left transition-colors",
              value === opt.value
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-background hover:bg-muted/30",
            )}
            onClick={() => onChange(opt.value)}
          >
            <span className="text-xs font-medium">{opt.label}</span>
            {opt.description && (
              <span className="mt-0.5 text-[10px] text-muted-foreground">{opt.description}</span>
            )}
          </button>
        ))}
      </div>
      <ShareFundingDiagram
        senderLabel={senderLabel}
        receiverLabel={receiverLabel}
        senderPays={selected.senderPays}
      />
    </div>
  )
}
