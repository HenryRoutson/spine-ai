"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Code2, LayoutGrid, FileSpreadsheet, Sparkles, Sparkle, AlertTriangle, Lock } from "lucide-react"
import { StructureFieldRow } from "@/components/structure-field-row"
import { StructureAssistant } from "@/components/structure-assistant"
import { StructureExcelEditor } from "@/components/structure-excel-editor"
import { StructureSourceDocLink } from "@/components/structure-source-doc-link"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { useAppShell } from "@/lib/app-shell"
import { useStore, uid } from "@/lib/store"
import { allModelsToPydantic } from "@/lib/pydantic"
import { isLockedStructureModel } from "@/lib/structure"
import type { ModelField, StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"

export function StructureBuilder() {
  const { models, setModels } = useStore()
  const { focusStructureId, clearFocusStructure } = useAppShell()
  const [selectedId, setSelectedId] = useState<string>(models[0]?.id ?? "")
  const [view, setView] = useState<"ui" | "excel" | "code" | "ai">("ui")

  // AI : jump here from JSON preview "validates as" links.
  useEffect(() => {
    if (!focusStructureId) return
    if (!models.some((m) => m.id === focusStructureId)) return
    setSelectedId(focusStructureId)
    setView("ui")
    clearFocusStructure()
  }, [focusStructureId, models, clearFocusStructure])

  const selected = models.find((m) => m.id === selectedId) ?? models[0]
  const selectedLocked = selected ? isLockedStructureModel(selected) : false

  function updateModel(next: StructureModel) {
    if (isLockedStructureModel(next)) return
    setModels(models.map((m) => (m.id === next.id ? next : m)))
  }

  function addModel() {
    const m: StructureModel = {
      id: uid(),
      name: "NewModel",
      description: "",
      fields: [
        { id: uid(), name: "field", type: "text", optional: false, description: "" },
      ],
    }
    setModels([...models, m])
    setSelectedId(m.id)
  }

  function deleteModel(id: string) {
    const target = models.find((m) => m.id === id)
    if (target && isLockedStructureModel(target)) return
    const next = models.filter((m) => m.id !== id)
    setModels(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? "")
  }

  function addField() {
    if (!selected) return
    updateModel({
      ...selected,
      fields: [
        ...selected.fields,
        { id: uid(), name: "field", type: "text", optional: false, description: "" },
      ],
    })
  }

  function updateField(fieldId: string, patch: Partial<ModelField>) {
    if (!selected) return
    updateModel({
      ...selected,
      fields: selected.fields.map((f) =>
        f.id === fieldId ? { ...f, ...patch } : f,
      ),
    })
  }

  function removeField(fieldId: string) {
    if (!selected) return
    updateModel({
      ...selected,
      fields: selected.fields.filter((f) => f.id !== fieldId),
    })
  }

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="01 / Structure"
        title="Output Structures"
        description="Define the pydantic models your LLM must output to. Schema validation is implicit on every step's I/O."
        actions={
          <div className="flex items-center rounded-md border border-border p-0.5">
            <button
              onClick={() => setView("ui")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
                view === "ui"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Form
            </button>
            <button
              onClick={() => setView("excel")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
                view === "excel"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
            <button
              onClick={() => setView("code")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
                view === "code"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Code2 className="h-3.5 w-3.5" /> Code
            </button>
            <button
              onClick={() => setView("ai")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
                view === "ai"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkle className="h-3.5 w-3.5" /> AI
            </button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* model list — hidden in excel view (sheet tabs handle navigation) */}
        {view !== "excel" && (
        <aside className="flex w-52 shrink-0 flex-col border-r border-border">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Models
            </span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addModel}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {models.length === 0 && (
              <p className="px-2 py-4 text-center font-mono text-[10px] text-muted-foreground">
                no models yet
              </p>
            )}
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  "group mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors",
                  m.id === selected?.id ? "bg-secondary" : "hover:bg-secondary/50",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-foreground">{m.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {m.fields.length} fields
                  </p>
                </div>
                {m.auto && <Sparkles className="h-3 w-3 shrink-0 text-chart-3" />}
                {m.sourceDocId && (
                  <Badge variant="outline" className="h-4 shrink-0 px-1 font-mono text-[8px]">
                    doc
                  </Badge>
                )}
                {isLockedStructureModel(m) && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
              </button>
            ))}
          </div>
        </aside>
        )}

        {/* editor */}
        {view === "excel" ? (
          <StructureExcelEditor selectedId={selectedId} onSelectId={setSelectedId} />
        ) : view === "ui" && selected ? (
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-5 py-5">
              {selectedLocked && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="font-mono text-[11px] text-muted-foreground">
                    shared built-in structure — available in every project and cannot be edited
                  </p>
                </div>
              )}
              {selected.auto && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-chart-3/40 bg-chart-3/10 px-3 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-chart-3" />
                  <p className="font-mono text-[11px] text-chart-3">
                    {selected.sourceDocId
                      ? "auto-generated from a document — edit freely or open the source below"
                      : "auto-generated by a Combine Inputs step"}
                  </p>
                </div>
              )}
              {selected.sourceDocId && (
                <div className="mb-4">
                  <StructureSourceDocLink sourceDocId={selected.sourceDocId} />
                </div>
              )}
              {selected.fields.length === 0 && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                  <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", WARNING_TEXT_CLASS)} />
                  <p className={cn("font-mono text-[11px]", WARNING_TEXT_CLASS)}>
                    this model has no fields — add at least one before using it in a pipeline step
                  </p>
                </div>
              )}
              <div className="mb-5 flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <Input
                    value={selected.name}
                    onChange={(e) => updateModel({ ...selected, name: e.target.value })}
                    readOnly={selectedLocked}
                    className="h-9 font-mono text-sm font-medium"
                  />
                  <Input
                    value={selected.description}
                    placeholder="Docstring describing this model…"
                    onChange={(e) =>
                      updateModel({ ...selected, description: e.target.value })
                    }
                    readOnly={selectedLocked}
                    className="h-8 text-xs text-muted-foreground"
                  />
                </div>
                {models.length > 1 && !selectedLocked && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteModel(selected.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[1.1fr_1fr_1.2fr_1fr_auto] gap-2 border-b border-border bg-secondary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Name</span>
                  <span>Type</span>
                  <span>Description</span>
                  <span>Example</span>
                  <span className="w-14 text-center">Opt</span>
                </div>
                {selected.fields.map((f) => (
                  <StructureFieldRow
                    key={f.id}
                    field={f}
                    fields={selected.fields}
                    models={models}
                    selectedId={selected.id}
                    locked={selectedLocked}
                    onUpdate={(patch) => updateField(f.id, patch)}
                    onRemove={() => removeField(f.id)}
                  />
                ))}
              </div>

              {!selectedLocked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 bg-transparent"
                  onClick={addField}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add field
                </Button>
              )}

              <p className="mt-4 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {'`text` reads as a string for non-technical reviewers. `tuple[text, quote]` links extracted text back to its source span.'}
              </p>
            </div>
          </div>
        ) : view === "ai" ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <StructureAssistant />
          </div>
        ) : view === "code" ? (
          <div className="min-w-0 flex-1 overflow-y-auto bg-[oklch(0.14_0.004_264)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="font-mono text-[11px] text-muted-foreground">models.py</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                generated
              </Badge>
            </div>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-xs leading-relaxed text-foreground">
              <code>{allModelsToPydantic(models)}</code>
            </pre>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-muted-foreground">No model selected.</p>
          </div>
        )}
      </div>
    </div>
  )
}
