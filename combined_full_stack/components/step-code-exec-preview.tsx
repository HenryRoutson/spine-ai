"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { CodeLineProfile } from "@/lib/code-exec-ui"
import { parseCodeProfileKey } from "@/lib/custom_code_trace"
import { CODE_LANG_NAME, CODE_LANG_SHORT, MonacoSyntaxLine, useMonacoSyntaxLines } from "@/lib/code-syntax-highlight"
import type { CustomCodeLanguage } from "@/lib/types"

export function StepCodeExecPreview({
  code,
  language,
  activeLine,
  activeSlot,
  lineMs,
  compact = false,
  className,
}: {
  code: string
  language: CustomCodeLanguage
  activeLine?: number
  activeSlot?: number
  lineMs?: CodeLineProfile
  compact?: boolean
  className?: string
}) {
  const lines = code.split("\n")
  const highlighted = useMonacoSyntaxLines(code, language)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const maxMs = Math.max(...Object.values(lineMs ?? {}), 0.01)
  const isLive = activeLine != null
  const hasProfile = !isLive && lineMs && Object.keys(lineMs).length > 0

  useEffect(() => {
    if (activeLine == null) return
    const row = lineRefs.current.get(activeLine)
    if (!row || !scrollRef.current) return
    const container = scrollRef.current
    const rowTop = row.offsetTop
    const rowBottom = rowTop + row.offsetHeight
    const viewTop = container.scrollTop
    const viewBottom = viewTop + container.clientHeight
    if (rowTop < viewTop || rowBottom > viewBottom) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [activeLine, activeSlot])
  const slotsByLine = new Map<number, { slot: number; ms: number }[]>()
  for (const [key, ms] of Object.entries(lineMs ?? {})) {
    const { line, slot } = parseCodeProfileKey(key)
    if (slot <= 0) continue
    const list = slotsByLine.get(line) ?? []
    list.push({ slot, ms })
    slotsByLine.set(line, list)
  }
  for (const list of slotsByLine.values()) list.sort((a, b) => a.slot - b.slot)

  return (
    <div className={cn("mt-2", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
          {activeLine != null
            ? `running line ${activeLine}${activeSlot != null ? ` · λ${activeSlot}` : ""}`
            : hasProfile
              ? "code profile"
              : "code"}
        </p>
        <span
          className="rounded border border-border bg-muted/50 px-1.5 py-px font-mono text-[8px] font-medium uppercase tracking-wide text-muted-foreground"
          title={CODE_LANG_NAME[language]}
        >
          {CODE_LANG_SHORT[language]}
        </span>
      </div>
      <div
        ref={scrollRef}
        className={cn(
          "relative overflow-y-auto rounded border border-border bg-[#1e1e1e] font-mono leading-snug text-[#d4d4d4]",
          compact ? "max-h-36 text-[9px]" : "max-h-56 text-[10px]",
        )}
      >
        {lines.map((line, i) => {
          const ln = i + 1
          const ms = lineMs?.[String(ln)]
          const slots = slotsByLine.get(ln) ?? []
          const isActive = activeLine === ln
          const barPct = ms != null ? Math.max(4, Math.round((ms / maxMs) * 100)) : 0
          return (
            <div
              key={ln}
              ref={(el) => {
                if (el) lineRefs.current.set(ln, el)
                else lineRefs.current.delete(ln)
              }}
            >
              <div
                className={cn(
                  "flex min-w-0 items-start gap-1.5 border-l-2 border-transparent px-1.5 py-px",
                  isActive && "border-primary bg-primary/20",
                  hasProfile && ms != null && ms === maxMs && maxMs > 1 && "bg-amber-500/10",
                )}
              >
                <span
                  className={cn(
                    "w-5 shrink-0 select-none text-right tabular-nums",
                    isActive ? "text-primary" : "text-muted-foreground/60",
                  )}
                >
                  {ln}
                </span>
                {hasProfile && (
                  <span className="w-11 shrink-0 tabular-nums text-muted-foreground/80">
                    {ms != null ? `${ms < 10 ? ms.toFixed(1) : Math.round(ms)}ms` : ""}
                  </span>
                )}
                {hasProfile && (
                  <span className="mt-1.5 h-1 shrink-0 rounded-full bg-primary/25" style={{ width: `${barPct * 0.28}px` }} />
                )}
              <span className={cn("min-w-0 flex-1 whitespace-pre-wrap break-all", isActive && "brightness-110")}>
                {line ? <MonacoSyntaxLine spans={highlighted?.[i]} fallback={line} /> : " "}
              </span>
              </div>
              {slots.map(({ slot, ms: slotMs }) => {
                const slotActive = activeLine === ln && activeSlot === slot
                const slotBarPct = Math.max(4, Math.round((slotMs / maxMs) * 100))
                return (
                  <div
                    key={`${ln}.${slot}`}
                    className={cn(
                      "flex min-w-0 items-start gap-1.5 border-l-2 border-transparent py-px pl-5 pr-1.5",
                      slotActive && "border-primary bg-primary/15",
                      !isLive && slotMs === maxMs && maxMs > 1 && "bg-amber-500/10",
                    )}
                  >
                    <span
                      className={cn(
                        "w-8 shrink-0 select-none text-right font-mono text-[8px] tabular-nums",
                        slotActive ? "text-primary" : "text-muted-foreground/50",
                      )}
                    >
                      λ{slot}
                    </span>
                    <span className="w-11 shrink-0 tabular-nums text-muted-foreground/70">
                      {slotMs < 10 ? slotMs.toFixed(1) : Math.round(slotMs)}ms
                    </span>
                    <span className="mt-1.5 h-1 shrink-0 rounded-full bg-primary/20" style={{ width: `${slotBarPct * 0.22}px` }} />
                    <span className="min-w-0 flex-1 text-[9px] text-muted-foreground/70">inline lambda</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
