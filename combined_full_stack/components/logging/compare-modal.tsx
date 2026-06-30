"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { RunPickerColumn } from "@/components/logging/run-picker-column"
import type { DocId, PipelineRun } from "@/lib/types"

type CompareModalProps = {
  runs: PipelineRun[]
  runInputLabel: (run: PipelineRun) => string
  runInputDocIds: (run: PipelineRun) => DocId[]
  initialRunId?: string
  onClose: () => void
}

export function CompareModal({ runs, runInputLabel, runInputDocIds, initialRunId, onClose }: CompareModalProps) {
  const [compareRunA, setCompareRunA] = useState<string>(initialRunId ?? runs[0]?.id ?? "")
  const [compareRunB, setCompareRunB] = useState<string>(
    runs.find((r) => r.id !== initialRunId)?.id ?? runs[1]?.id ?? "",
  )
  const [compareQueryA, setCompareQueryA] = useState("")
  const [compareQueryB, setCompareQueryB] = useState("")

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close compare"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="font-mono text-xs text-muted-foreground">compare_logs</span>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid h-[min(32rem,52vh)] min-h-[16rem] grid-cols-2 divide-x divide-border">
          <RunPickerColumn
            label="Pipeline A"
            runs={runs}
            runInputLabel={runInputLabel}
            runInputDocIds={runInputDocIds}
            selectedId={compareRunA}
            onSelect={setCompareRunA}
            query={compareQueryA}
            onQueryChange={setCompareQueryA}
          />
          <RunPickerColumn
            label="Pipeline B"
            runs={runs}
            runInputLabel={runInputLabel}
            runInputDocIds={runInputDocIds}
            selectedId={compareRunB}
            onSelect={setCompareRunB}
            query={compareQueryB}
            onQueryChange={setCompareQueryB}
          />
        </div>
        <div className="border-t border-border px-4 py-3">
          <p className="text-center text-xs text-muted-foreground">Not yet implemented.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
