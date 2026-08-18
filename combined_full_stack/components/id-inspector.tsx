"use client"

import { useMemo, useState } from "react"
import { formatInspectIds, type IdIndex } from "@/lib/sql-id-index"
import type { StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"

export function IdInspector({
  index,
  models,
  idType,
  loading,
}: {
  index: IdIndex
  models: StructureModel[]
  idType?: string
  loading?: boolean
}) {
  const [filter, setFilter] = useState<"all" | "missing" | "unused" | "duplicate">("all")
  const report = useMemo(
    () => formatInspectIds(index, models, { idType, filter: idType ? filter : "all" }),
    [index, models, idType, filter],
  )
  const summary = report.idTypes[0]

  if (loading) {
    return <p className="px-4 py-3 font-mono text-[11px] text-muted-foreground">Loading catalog…</p>
  }
  if (!report.idTypes.length) {
    return (
      <p className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
        No PK/FK id types yet — set Key on a field to PK or FK.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <p className="font-mono text-sm font-semibold text-foreground">{idType ?? "All id types"}</p>
        {summary && (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {summary.pk} · {summary.pkCount} pk · {summary.fkCount} fk · {summary.missing} missing ·{" "}
            {summary.unused} unused · {summary.duplicate} dup
          </p>
        )}
        {idType && (
          <div className="mt-2 flex gap-1">
            {(["all", "missing", "unused", "duplicate"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                  filter === f ? "border-border bg-secondary text-foreground" : "border-transparent text-muted-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
        {report.values.length === 0 && (
          <p className="font-mono text-[11px] text-muted-foreground">No rows for this filter.</p>
        )}
        {report.values.map((row) => (
          <div key={row.value} className="mb-2 border-b border-border/60 pb-2">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-foreground">{row.value}</span>
              <span
                className={cn(
                  "text-[10px] uppercase",
                  row.status === "ok" && "text-muted-foreground",
                  row.status === "missing" && "text-destructive",
                  row.status === "duplicate" && "text-destructive",
                  row.status === "unused" && "text-amber-600 dark:text-amber-500",
                )}
              >
                {row.status}
              </span>
            </div>
            <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-muted-foreground">
              {row.occurrences.map((occ, i) => (
                <li key={`${occ.table}:${occ.field}:${occ.source.jsonPath}:${i}`}>
                  {occ.kind} · {occ.table}.{occ.field}
                  {occ.source.docName ? ` · ${occ.source.docName}` : ""} {occ.source.jsonPath}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
