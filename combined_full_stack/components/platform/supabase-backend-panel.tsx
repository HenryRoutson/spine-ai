"use client"

import { useMemo, useState } from "react"
import { Copy, Database, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReadonlyCodeViewer } from "@/components/code-viewer"
import { spineActionProps } from "@/lib/core/parity"
import { allModelsToSql } from "@/lib/sql-schema"
import {
  modelDisplayName,
  structureFieldCount,
  structureSummary,
} from "@/lib/platform-type-ports"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"
import type { PipelineModule, StructureModel, TypeAlias } from "@/lib/types"
import { cn } from "@/lib/utils"

// AI : Supabase backend view — schema from structures + shared state summary.
export function SupabaseBackendPanel({
  models,
  modules,
  typeAliases,
  className,
}: {
  models: StructureModel[]
  modules: PipelineModule[]
  typeAliases: TypeAlias[]
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const [showSql, setShowSql] = useState(false)

  const schemaSql = useMemo(() => allModelsToSql(models, modules), [models, modules])
  const userModels = useMemo(() => models.filter((m) => !m.auto), [models])

  async function copySchema() {
    await copyTextToClipboard(schemaSql)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <Database className="h-4 w-4" />
          Supabase schema
        </h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          SQL generated from Structures. Every website on this project shares these tables — the pipeline is what
          processes the rows.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            {userModels.length} table{userModels.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px]"
              onClick={() => setShowSql((v) => !v)}
              {...spineActionProps("platform.toggle-sql")}
            >
              {showSql ? "Hide SQL" : "View SQL"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px]"
              onClick={copySchema}
              {...spineActionProps("platform.copy-schema")}
            >
              <Copy className="mr-1 h-3 w-3" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {userModels.map((model) => (
            <li key={model.id} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs font-medium">{model.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {structureFieldCount(model)} field{structureFieldCount(model) !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="mt-0.5 pl-5 font-mono text-[10px] text-muted-foreground">
                {structureSummary(model, models, typeAliases)}
              </p>
            </li>
          ))}
          {userModels.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-muted-foreground">
              No structures yet — describe your data in Vibe chat to create tables.
            </li>
          ) : null}
        </ul>
      </div>

      {showSql ? (
        <div className="h-64 overflow-hidden rounded-lg border border-border">
          <ReadonlyCodeViewer value={schemaSql} language="sql" className="h-full" />
        </div>
      ) : null}

      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Coming soon:</strong> provision an isolated Supabase project for this
          website. Until then, schema is annotation-only — runtime values stay as JSON maps in pipeline runs.
        </p>
      </div>
    </div>
  )
}

export function SupabaseBackendPanelForProject({
  models,
  modules,
  typeAliases,
}: {
  models: StructureModel[]
  modules: PipelineModule[]
  typeAliases: TypeAlias[]
}) {
  return (
    <SupabaseBackendPanel
      models={models}
      modules={modules}
      typeAliases={typeAliases}
    />
  )
}
