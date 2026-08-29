"use client"

import type { ReactNode } from "react"
import { Table2 } from "lucide-react"
import { rowsForModel, rowsStoreForProject, type project_row_store } from "@/lib/platform-row-store"
import { friendlyFieldName } from "@/lib/platform-row-fields"
import { QuoteButton } from "@/components/quote-links"
import { isLinkedQuoteValue, quoteDisplayText, quoteHref } from "@/lib/quotes"
import type { Project, StructureModel } from "@/lib/types"

// AI : {{table:Model}} — live rows from the project structure store, shared across frontends.
// AI : TODO (spine-in-spine-bootstrap-S6-mirror) — when this slot is the Spine-in-Spine guest builder,
// AI :   Project / Document / PipelineRun / SharedLink / Earnings read the host SpineSession snapshot
// AI :   (HOST_MIRROR_MODELS), not nested structureRows. Writes go through SESSION_ACTIONS (S3).
export function HostedTableSlot({
  model,
  store,
}: {
  model: StructureModel | undefined
  store: project_row_store
}) {
  if (!model) {
    return (
      <p className="px-4 py-3 text-xs text-muted-foreground">
        Table slot has no matching structure — name the model in {"{{table:ModelName}}"}.
      </p>
    )
  }
  const rows = rowsForModel(store, model.id)
  const fields = (model.fields ?? []).slice(0, 6)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-xs font-medium">{model.name}</span>
        <span className="text-[10px] text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
          No rows yet — add them on this structure in Structures.
        </p>
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-muted/40 font-mono text-[10px] uppercase text-muted-foreground">
              <tr>
                {fields.map((f) => (
                  <th key={f.id} className="px-3 py-1.5 font-medium">
                    {friendlyFieldName(f.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  {fields.map((f) => (
                    <td key={f.id} className="max-w-[12rem] truncate px-3 py-1.5 font-mono">
                      {formatCell(row.data[f.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function hostedTableSlotsForProject(
  project: Pick<Project, "id" | "models" | "structureRows">,
): Record<string, ReactNode> {
  const store = rowsStoreForProject(project)
  const out: Record<string, ReactNode> = {}
  for (const model of project.models.filter((m) => !m.auto)) {
    out[model.name] = <HostedTableSlot key={model.id} model={model} store={store} />
  }
  return out
}

function formatCell(value: unknown): ReactNode {
  if (isLinkedQuoteValue(value)) {
    return (
      <QuoteButton
        quote={{
          text: value.text,
          doc_id: value.quote.doc_id,
          start: value.quote.start,
          end: value.quote.end,
          href: quoteHref({ docId: value.quote.doc_id, start: value.quote.start, end: value.quote.end }),
        }}
      />
    )
  }
  const quoted = quoteDisplayText(value)
  if (quoted != null) return quoted
  if (value == null) return "—"
  if (Array.isArray(value) && value.length === 0) return "—"
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    const json = JSON.stringify(value)
    if (/"doc_id"\s*:/.test(json)) return "—"
    return json
  } catch {
    return String(value)
  }
}
