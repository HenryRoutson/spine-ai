"use client"

import { Check, HelpCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InputCompatKeyResult, InputCompatPairResult } from "@/lib/input-compat"
import { inputCompatPairLabel } from "@/lib/input-compat"

const STATUS_STYLE: Record<InputCompatKeyResult["status"], { label: string; className: string; Icon: typeof Check }> = {
  match: {
    label: "MATCH",
    className: "border-chart-2/40 bg-chart-2/10 text-chart-2",
    Icon: Check,
  },
  mismatch: {
    label: "MISMATCH",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    Icon: X,
  },
  missing: {
    label: "MISSING",
    className: "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
    Icon: HelpCircle,
  },
}

function CompatKeyChip({ keyResult }: { keyResult: InputCompatKeyResult }) {
  const style = STATUS_STYLE[keyResult.status]
  const Icon = style.Icon
  const detail =
    keyResult.status === "match"
      ? keyResult.upstreamValue
      : [keyResult.upstreamValue, keyResult.localValue].filter(Boolean).join(" vs ")

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 font-mono text-[10px]",
        style.className,
      )}
      title={detail || undefined}
    >
      <span className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="font-semibold">{style.label}</span>
        <span className="truncate">{keyResult.label}</span>
      </span>
      {keyResult.status !== "match" && detail ? (
        <span className="truncate opacity-90">{detail}</span>
      ) : null}
    </div>
  )
}

export function InputCompatPanel({ pairs }: { pairs: InputCompatPairResult[] }) {
  if (!pairs.length) return null

  return (
    <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-yellow-700 dark:text-yellow-500">
        input pairing
      </p>
      {pairs.map((pair) => (
        <div key={`${pair.localModuleId}:${pair.localDocName ?? ""}`} className="space-y-1.5">
          <p className="font-mono text-[10px] text-muted-foreground">{inputCompatPairLabel(pair)}</p>
          <div className="flex flex-wrap gap-1.5">
            {pair.keys.map((k) => (
              <CompatKeyChip key={k.label} keyResult={k} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
