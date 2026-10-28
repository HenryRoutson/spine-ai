"use client"

import { useState } from "react"
import { Table2 } from "lucide-react"
import { JsonHighlight } from "@/components/highlight"
import { PopupModal } from "@/components/logging/popup-modal"
import type { StructureModel } from "@/lib/types"

type StepResponseJsonTextProps = {
  json: string
  title: string
  models?: StructureModel[]
}

// AI : raw JSON text under a prompt — table/excel viewer is opt-in, not the default.
export function StepResponseJsonText({ json, title, models }: StepResponseJsonTextProps) {
  const [tableOpen, setTableOpen] = useState(false)

  return (
    <div className="mt-2 border-t border-border/80 pt-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Response
        </span>
        <button
          type="button"
          onClick={() => setTableOpen(true)}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Open spreadsheet-style preview"
        >
          <Table2 className="h-3 w-3" />
          Table
        </button>
      </div>
      <JsonHighlight json={json} />
      {tableOpen ? (
        <PopupModal
          payload={{ json, title, models, defaultView: "table" }}
          onClose={() => setTableOpen(false)}
        />
      ) : null}
    </div>
  )
}
