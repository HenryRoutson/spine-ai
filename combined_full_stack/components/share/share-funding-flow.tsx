"use client"

import { ArrowRight, CircleDollarSign, Lock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type ShareFundingChoice = {
  value: string
  label: string
  senderPays: boolean
  receiverSignInRequired?: boolean
  description?: string
}

export function ShareFundingDiagram({
  senderLabel,
  receiverLabel,
  senderPays,
  receiverSignInRequired = false,
}: {
  senderLabel: string
  receiverLabel: string
  senderPays: boolean
  receiverSignInRequired?: boolean
}) {
  return (
    <div
      className="flex items-center justify-center gap-3 rounded-md border border-border bg-muted/15 px-4 py-3"
      aria-label={
        senderPays
          ? `${senderLabel} pays${receiverSignInRequired ? `, ${receiverLabel} signs in` : ""}`
          : `${receiverLabel} pays and signs in`
      }
    >
      <FundingParty label={senderLabel} pays={senderPays} />
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <FundingParty
        label={receiverLabel}
        pays={!senderPays}
        signInRequired={receiverSignInRequired}
      />
    </div>
  )
}

function FundingParty({
  label,
  pays,
  signInRequired = false,
}: {
  label: string
  pays: boolean
  signInRequired?: boolean
}) {
  const active = pays || signInRequired

  return (
    <div
      className={cn(
        "flex min-w-[5.5rem] flex-col items-center gap-1 rounded-md border px-3 py-2 text-center transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      <div className="flex h-4 items-center gap-1">
        {pays && <CircleDollarSign className="h-4 w-4 text-primary" aria-hidden />}
        {signInRequired && <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />}
        {!pays && !signInRequired && <span className="h-4" aria-hidden />}
      </div>
      <span className="text-xs font-medium">{label}</span>
      {(pays || signInRequired) && (
        <div className="flex flex-wrap items-center justify-center gap-x-1 font-mono text-[9px] uppercase tracking-wider text-primary">
          {pays && <span>pays</span>}
          {pays && signInRequired && <span aria-hidden>·</span>}
          {signInRequired && <span>sign in</span>}
        </div>
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
        receiverSignInRequired={selected.receiverSignInRequired}
      />
    </div>
  )
}
