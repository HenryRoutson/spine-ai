"use client"

import { useEffect, useRef } from "react"
import type { PipelineRun } from "@/lib/types"

// AI : persist draft notes when leaving a run — capture runId at mount so cleanup targets the run you left, not the next one.
export function useRunNotesFlushOnLeave(
  runId: PipelineRun["id"] | undefined,
  draft: string,
  persistedNotes: string | undefined,
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>,
  onSaved?: (runId: PipelineRun["id"], notes: string | undefined) => void,
) {
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    const leavingRunId = runId
    const leavingSaved = persistedNotes

    return () => {
      if (!leavingRunId) return
      const trimmed = draftRef.current.trim()
      const next = trimmed || undefined
      // AI : cache-hit loads run.notes but draft stays "" — never wipe persisted notes on leave.
      if (!trimmed && leavingSaved) return
      if (trimmed === (leavingSaved ?? "")) return
      void updateRunNotes(leavingRunId, next)
        .then(() => onSaved?.(leavingRunId, next))
        .catch(console.error)
    }
  }, [runId, persistedNotes, updateRunNotes, onSaved])
}
