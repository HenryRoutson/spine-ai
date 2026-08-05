"use client"

import { Bot } from "lucide-react"
import { useDiagnosisAgents } from "@/lib/diagnosis-agent-context"
import { cn } from "@/lib/utils"
import type { RunId } from "@/lib/types"

export function DiagnosisRunLink({
  runId,
  className,
}: {
  runId: RunId | string
  className?: string
}) {
  const { sessionForRun, openDiagnosisForRun } = useDiagnosisAgents()
  const session = sessionForRun(runId)
  if (!session) return null

  return (
    <button
      type="button"
      onClick={() => openDiagnosisForRun(runId)}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline",
        className,
      )}
      title={`Open diagnosis agent for run ${runId}`}
    >
      <Bot className="h-3 w-3" />
      diagnosis
      <span className="text-muted-foreground/70">· {session.id.slice(0, 8)}</span>
    </button>
  )
}
