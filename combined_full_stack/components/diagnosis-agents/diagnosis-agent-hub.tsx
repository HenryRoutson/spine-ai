"use client"

import { useMemo } from "react"
import {
  AlertTriangle,
  Bot,
  Loader2,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { formatCostCents } from "@/lib/format"
import { useDiagnosisAgents } from "@/lib/diagnosis-agent-context"
import { useAppShell } from "@/lib/app-shell"
import { cn } from "@/lib/utils"
import type { DiagnosisAgentSession } from "@/lib/diagnosis-types"

function sessionStatusBadge(session: DiagnosisAgentSession) {
  if (session.status === "running") {
    return (
      <Badge variant="outline" className="gap-1 font-mono text-[9px]">
        <Loader2 className="h-3 w-3 animate-spin" />
        running
      </Badge>
    )
  }
  if (session.status === "error") {
    return (
      <Badge variant="outline" className="border-destructive/50 font-mono text-[9px] text-destructive">
        failed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="font-mono text-[9px] text-chart-2">
      done
    </Badge>
  )
}

export function DiagnosisAgentHub() {
  const {
    open,
    toggle,
    sessions,
    activeSessionId,
    setActiveSessionId,
    totalCostCents,
    runningCount,
  } = useDiagnosisAgents()
  const { openLogging } = useAppShell()

  const active = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null,
    [sessions, activeSessionId],
  )

  const showHub = sessions.length > 0

  return (
    <>
      {showHub && (
        <Button
          type="button"
          size="sm"
          variant={open ? "secondary" : "outline"}
          onClick={toggle}
          aria-label="Diagnosis agents"
          title="Diagnosis agents"
          className="relative shrink-0 font-mono text-[11px]"
        >
          <Bot className="h-3.5 w-3.5" />
          Diagnosis
          {runningCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">
              {runningCount}
            </span>
          )}
        </Button>
      )}

      {open && (
        <div className="fixed inset-y-0 right-0 z-[55] flex w-full sm:max-w-lg flex-col border-l border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Diagnosis agents
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {sessions.length} session{sessions.length === 1 ? "" : "s"} ·{" "}
                {formatCostCents(totalCostCents)} agent cost
              </p>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" onClick={toggle} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr]">
            <ScrollArea className="max-h-40 border-b border-border">
              {sessions.length === 0 ? (
                <p className="p-3 font-mono text-[10px] text-muted-foreground">
                  Failed runs auto-spawn diagnosis agents here. You can also start one from Logging.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSessionId(session.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-accent/60",
                          active?.id === session.id && "bg-accent",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[10px]">{session.runLabel}</span>
                          {sessionStatusBadge(session)}
                        </div>
                        <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                          <span className="truncate">{session.runId}</span>
                          <span>
                            {session.autoStarted ? "auto" : "manual"} ·{" "}
                            {formatCostCents(session.costCents)}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>

            <ScrollArea className="min-h-0 flex-1">
              {!active ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Run a pipeline; if it fails, a diagnosis agent starts automatically with error-only
                    context and the pipeline snapshot.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {sessionStatusBadge(active)}
                    {active.autoStarted && (
                      <Badge variant="secondary" className="font-mono text-[9px]">
                        auto-started
                      </Badge>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 font-mono text-[10px]"
                      onClick={() => openLogging(active.runId)}
                    >
                      <ScrollText className="h-3 w-3" />
                      view log
                    </Button>
                  </div>

                  {active.status === "error" && active.errorMessage && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <p className="font-mono text-[11px] text-destructive">{active.errorMessage}</p>
                    </div>
                  )}

                  {active.status === "running" && !active.responseText && (
                    <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Diagnosing with error-only context…
                    </p>
                  )}

                  {active.responseText && (
                    <article className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                      {active.responseText}
                    </article>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
    </>
  )
}
