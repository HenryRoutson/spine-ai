"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Sparkles } from "lucide-react"
import { useAppShell } from "@/lib/app-shell"
import { inferStructuresFromDocContent, type DerivedDocStructure } from "@/lib/doc-structure-infer"
import { findMatchingStructures } from "@/lib/structure-match"
import { useStore, uid } from "@/lib/store"
import { API_ROUTES } from "@/lib/api-routes"
import { StructureMatchChips, STRUCTURE_MATCH_CHIP_CLASS } from "@/components/structure-match-chips"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DocId, DocRef, StructureModel, StructureModelId } from "@/lib/types"

function cloneDerivedForProject(
  derived: DerivedDocStructure,
  docId: DocId,
): StructureModel {
  return {
    ...derived.model,
    id: uid<StructureModelId>(),
    sourceDocId: docId,
    auto: true,
    description: derived.model.description || `Inferred from document.`,
  }
}

function alreadyAdded(models: StructureModel[], docId: DocId, name: string): boolean {
  return models.some((m) => m.sourceDocId === docId && m.name === name)
}

export function DocDerivedStructures({
  doc,
  compact = false,
}: {
  doc: DocRef
  compact?: boolean
}) {
  const { models, setModels } = useStore()
  const { openStructure } = useAppShell()
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(API_ROUTES.docText(doc.id))
      .then((r) => r.json())
      .then((d: { content?: string; text?: string }) => {
        if (!cancelled) setContent(d.text ?? d.content ?? "")
      })
      .catch(() => {
        if (!cancelled) setContent("")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [doc.id])

  const derived = useMemo(() => {
    if (!content) return []
    return inferStructuresFromDocContent(content, doc.name, doc.type, () => uid<StructureModelId>())
  }, [content, doc.name, doc.type])

  const matches = useMemo(() => {
    if (!content?.trim()) return []
    try {
      const parsed = JSON.parse(content) as unknown
      return findMatchingStructures(parsed, models)
    } catch {
      return []
    }
  }, [content, models])

  function addStructure(d: DerivedDocStructure) {
    if (alreadyAdded(models, doc.id, d.model.name)) {
      const existing = models.find((m) => m.sourceDocId === doc.id && m.name === d.model.name)
      if (existing) openStructure(existing.id)
      return
    }
    const next = cloneDerivedForProject(d, doc.id)
    setModels([...models, next])
    openStructure(next.id)
  }

  if (loading) {
    return (
      <p className="font-mono text-[10px] text-muted-foreground">
        {compact ? "…" : "Loading structure preview…"}
      </p>
    )
  }

  if (!derived.length && !matches.length) return null

  return (
    <div className={cn("space-y-2", compact ? "mt-1.5" : "mt-2 rounded-md border border-border bg-secondary/20 px-3 py-2")}>
      {matches.length > 0 && (
        <StructureMatchChips
          matches={matches}
          onOpenStructure={(modelId) => openStructure(modelId)}
        />
      )}

      {derived.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Derived
          </span>
          {derived.map((d) => {
            const added = alreadyAdded(models, doc.id, d.model.name)
            return (
              <button
                key={`${d.model.name}:${d.sheetName ?? "main"}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (added) {
                    const existing = models.find((m) => m.sourceDocId === doc.id && m.name === d.model.name)
                    if (existing) openStructure(existing.id)
                    return
                  }
                  addStructure(d)
                }}
                className={cn(
                  STRUCTURE_MATCH_CHIP_CLASS,
                  added
                    ? "border-chart-3/40 bg-chart-3/5"
                    : "transition-colors hover:border-primary/40 hover:bg-primary/5",
                )}
                title={
                  added
                    ? `Open ${d.model.name} in Structure tab`
                    : `Add ${d.model.name} to project structures`
                }
              >
                <Sparkles className="h-3 w-3 shrink-0 text-chart-3" />
                <span className="truncate">{d.model.name}</span>
                <span className="text-muted-foreground">{d.model.fields.length}f</span>
                {d.matchKind === "list" && (
                  <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                    list
                  </Badge>
                )}
                {d.sheetName && (
                  <Badge variant="outline" className="h-4 px-1 font-mono text-[9px] text-muted-foreground">
                    {d.sheetName}
                  </Badge>
                )}
                {!added && <Plus className="h-3 w-3 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
