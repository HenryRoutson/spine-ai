"use client"

import { useEffect, useState } from "react"
import { RunNotesPad } from "@/components/run-notes-pad"
import { useStore } from "@/lib/store"
import { useRunNotesFlushOnLeave } from "@/lib/run-notes-flush"
import type { PipelineRun } from "@/lib/types"

// AI : editable run notes — persisted when switching runs or leaving Logging.
export function RunNotesEditor({
  runId,
  notes,
  hint = "Saved when you leave this window",
}: {
  runId: PipelineRun["id"]
  notes?: string
  hint?: string
}) {
  const { updateRunNotes } = useStore()
  const [draft, setDraft] = useState(notes ?? "")

  useEffect(() => {
    setDraft(notes ?? "")
  }, [runId, notes])

  useRunNotesFlushOnLeave(runId, draft, notes, updateRunNotes)

  return <RunNotesPad value={draft} onChange={setDraft} hint={hint} />
}
