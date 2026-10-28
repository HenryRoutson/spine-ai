"use client"

import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TypeExprEditor, defaultPlaygroundExpr } from "@/components/type-expr-editor"
import { TypeAliasPreview } from "@/components/type-expr-preview"
import { tryParseTypeExprString } from "@/lib/type-expr-parse"
import { typeExprHasUnset } from "@/lib/type-expr-edit"
import type { TypeExpr } from "@/lib/server/type_expr"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

function storageKey(projectId: string): string {
  return `spine-type-playground:${projectId}`
}

function loadExpr(projectId: string): TypeExpr {
  if (typeof window === "undefined") return defaultPlaygroundExpr()
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) return defaultPlaygroundExpr()
    return JSON.parse(raw) as TypeExpr
  } catch {
    return defaultPlaygroundExpr()
  }
}

export function TypeBuilderPanel() {
  const { project, models } = useStore()
  const [expr, setExpr] = useState<TypeExpr>(() => defaultPlaygroundExpr())
  const [textDraft, setTextDraft] = useState("")
  const [textError, setTextError] = useState<string | null>(null)

  useEffect(() => {
    const loaded = loadExpr(project.id)
    setExpr(loaded)
  }, [project.id])

  useEffect(() => {
    localStorage.setItem(storageKey(project.id), JSON.stringify(expr))
  }, [expr, project.id])

  useEffect(() => {
    setTextDraft("")
    setTextError(null)
  }, [expr])

  function applyText(raw: string) {
    setTextDraft(raw)
    const parsed = tryParseTypeExprString(raw, models)
    if (!parsed.ok) {
      setTextError(parsed.error)
      return
    }
    setTextError(null)
    setExpr(parsed.expr)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <p className="mx-auto mb-4 max-w-3xl font-mono text-[10px] leading-relaxed text-muted-foreground">
        Compose a single Python type inline — click UNSET placeholders to add list, dict, tuple,
        custom names like quote_id_t, or structure models. No struct fields here, just the type tree.
      </p>
      <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-lg border border-border bg-secondary/10 p-4">
            <TypeExprEditor expr={expr} models={models} onChange={setExpr} />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Or paste Python type text
            </label>
            <Input
              value={textDraft}
              placeholder="e.g. list[list[int]] | dict[str, quote_id_t] | set[UNSET]"
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={() => textDraft.trim() && applyText(textDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (textDraft.trim()) applyText(textDraft)
                }
              }}
              className={cn("font-mono text-xs", textError && "border-destructive")}
            />
            {textError && <p className="font-mono text-[10px] text-destructive">{textError}</p>}
          </div>

          <TypeAliasPreview expr={expr} models={models} />

          {typeExprHasUnset(expr) && (
            <p className="font-mono text-[10px] text-amber-600 dark:text-amber-500">
              This type still has UNSET slots — fill every placeholder before using it in a pipeline.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 font-mono text-[10px]"
            onClick={() => setExpr(defaultPlaygroundExpr())}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to list[UNSET]
          </Button>
        </div>
    </div>
  )
}
