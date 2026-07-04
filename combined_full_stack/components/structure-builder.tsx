"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, Code2, LayoutGrid, FileSpreadsheet, Sparkles, AlertTriangle, Lock, Braces } from "lucide-react"
import { StructureFieldRow } from "@/components/structure-field-row"
import { StructureExcelEditor } from "@/components/structure-excel-editor"
import { StructureSourceDocLink } from "@/components/structure-source-doc-link"
import { StructureTypeAliasEditor, TypeAliasTextSync } from "@/components/structure-type-alias-editor"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { useAppShell } from "@/lib/app-shell"
import { useStore, uid } from "@/lib/store"
import { StructureTypesCodeSection } from "@/components/structure-types-code-section"
import { TypeBuilderPanel } from "@/components/type-builder-panel"
import { ResizableSplit } from "@/components/resizable-split"
import {
  readStructureSidebarWidth,
  STRUCTURE_SIDEBAR_MAX,
  STRUCTURE_SIDEBAR_MIN,
  useStructureSidebarWidth,
  writeStructureSidebarWidth,
} from "@/lib/editor-split-settings"
import { isLockedStructureModel, lockedStructureBanner } from "@/lib/structure"
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import { UNSET_TYPE_EXPR } from "@/lib/server/type_expr"
import { FieldType, type ModelField, type StructureModel, type TypeAlias } from "@/lib/types"
import { cn } from "@/lib/utils"

type EditorTarget =
  | { kind: "struct"; id: string }
  | { kind: "type"; id: string }

export function StructureBuilder() {
  const { models, setModels, typeAliases, setTypeAliases } = useStore()
  const { focusStructureId, clearFocusStructure } = useAppShell()
  const [target, setTarget] = useState<EditorTarget>(() =>
    models[0]?.id ? { kind: "struct", id: models[0].id } : { kind: "struct", id: "" },
  )
  const [view, setView] = useState<"ui" | "excel" | "code" | "playground">("ui")
  const savedSidebarWidth = useStructureSidebarWidth()
  const [sidebarWidth, setSidebarWidth] = useState(readStructureSidebarWidth)
  useEffect(() => setSidebarWidth(savedSidebarWidth), [savedSidebarWidth])

  const selectedStructId = target.kind === "struct" ? target.id : models[0]?.id ?? ""
  const selectedTypeId = target.kind === "type" ? target.id : null

  // AI : jump here from JSON preview "validates as" links.
  useEffect(() => {
    if (!focusStructureId) return
    if (!models.some((m) => m.id === focusStructureId)) return
    setTarget({ kind: "struct", id: focusStructureId })
    setView("ui")
    clearFocusStructure()
  }, [focusStructureId, models, clearFocusStructure])

  const selected = models.find((m) => m.id === selectedStructId) ?? models[0]
  const selectedType = typeAliases.find((t) => t.id === selectedTypeId)
  const selectedLocked = selected ? isLockedStructureModel(selected) : false
  const structureIssues = useMemo(
    () => computeStructureIssues(models, typeAliases),
    [models, typeAliases],
  )
  const selectedStructIssues = useMemo(
    () => (selected ? structureIssues.filter((i) => i.modelId === selected.id) : []),
    [structureIssues, selected],
  )
  const selectedTypeIssues = useMemo(() => {
    if (!selectedType) return []
    const name = selectedType.name.trim()
    return structureIssues.filter(
      (i) => i.aliasName === name || i.aliasName?.startsWith(`${name} → `),
    )
  }, [structureIssues, selectedType])

  function updateModel(next: StructureModel) {
    if (isLockedStructureModel(next)) return
    setModels((prev) => prev.map((m) => (m.id === next.id ? next : m)))
  }

  function addStruct() {
    const m: StructureModel = {
      id: uid(),
      name: "NewStruct",
      description: "",
      fields: [{ id: uid(), name: "field", type: FieldType.Text, optional: false, description: "" }],
    }
    setModels([...models, m])
    setTarget({ kind: "struct", id: m.id })
  }

  function addType() {
    const t: TypeAlias = {
      id: uid(),
      name: "NewType",
      description: "",
      expr: UNSET_TYPE_EXPR,
    }
    setTypeAliases([...typeAliases, t])
    setTarget({ kind: "type", id: t.id })
    setView("ui")
  }

  function deleteType(id: string) {
    const next = typeAliases.filter((t) => t.id !== id)
    setTypeAliases(next)
    if (selectedTypeId === id) {
      setTarget(
        models[0]?.id
          ? { kind: "struct", id: models[0].id }
          : next[0]?.id
            ? { kind: "type", id: next[0].id }
            : { kind: "struct", id: "" },
      )
    }
  }

  function updateTypeAlias(id: string, patch: Partial<TypeAlias>) {
    setTypeAliases((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }


  function deleteModel(id: string) {
    const model = models.find((m) => m.id === id)
    if (model && isLockedStructureModel(model)) return
    const next = models.filter((m) => m.id !== id)
    setModels(next)
    if (target.kind === "struct" && target.id === id) {
      setTarget(next[0]?.id ? { kind: "struct", id: next[0].id } : { kind: "struct", id: "" })
    }
  }

  function addField() {
    if (!selectedStructId) return
    setModels((prev) =>
      prev.map((m) => {
        if (m.id !== selectedStructId || isLockedStructureModel(m)) return m
        return {
          ...m,
          fields: [
            ...m.fields,
            { id: uid(), name: "field", type: FieldType.Text, optional: false, description: "" },
          ],
        }
      }),
    )
  }

  function updateField(fieldId: string, patch: Partial<ModelField>) {
    if (!selectedStructId) return
    setModels((prev) =>
      prev.map((m) => {
        if (m.id !== selectedStructId || isLockedStructureModel(m)) return m
        return {
          ...m,
          fields: m.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
        }
      }),
    )
  }

  function removeField(fieldId: string) {
    if (!selectedStructId) return
    setModels((prev) =>
      prev.map((m) => {
        if (m.id !== selectedStructId || isLockedStructureModel(m)) return m
        return { ...m, fields: m.fields.filter((f) => f.id !== fieldId) }
      }),
    )
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
              onClick={() => setView("playground")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
                view === "playground"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Braces className="h-3.5 w-3.5" /> Playground
            </button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        {view === "playground" ? (
          <TypeBuilderPanel />
        ) : (
          <ResizableSplit
            className="min-h-0 flex-1"
            leadingWidth={sidebarWidth}
            onLeadingWidthChange={setSidebarWidth}
            onLeadingWidthCommit={writeStructureSidebarWidth}
            minLeading={STRUCTURE_SIDEBAR_MIN}
            maxLeading={STRUCTURE_SIDEBAR_MAX}
            leading={
              <aside className="flex min-h-0 flex-col overflow-hidden">
                <div className="space-y-1 px-2 pt-2">
                  <div className="flex items-center justify-between px-1 py-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Structs
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-full justify-start gap-1.5 bg-transparent font-mono text-[10px]"
                    onClick={addStruct}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add struct
                  </Button>
                </div>
                <div className="max-h-[40%] overflow-y-auto px-2 pb-2">
                  {models.length === 0 && (
                    <p className="px-2 py-2 text-center font-mono text-[10px] text-muted-foreground">
                      no structs yet
                    </p>
                  )}
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setTarget({ kind: "struct", id: m.id })}
                      className={cn(
                        "group mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors",
                        target.kind === "struct" && m.id === selectedStructId
                          ? "bg-secondary"
                          : "hover:bg-secondary/50",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="break-all font-mono text-xs text-foreground">{m.name}</p>
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

                <div className="border-t border-border px-2 py-2">
                  <div className="flex items-center justify-between px-1 py-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Types
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mb-2 h-7 w-full justify-start gap-1.5 bg-transparent font-mono text-[10px]"
                    onClick={addType}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add type
                  </Button>
                  <div className="max-h-[40%] overflow-y-auto">
                    {typeAliases.length === 0 && (
                      <p className="px-2 py-2 text-center font-mono text-[10px] text-muted-foreground">
                        no types yet — add quote_id_t, list[int], etc.
                      </p>
                    )}
                    {typeAliases.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTarget({ kind: "type", id: t.id })
                          setView("ui")
                        }}
                        className={cn(
                          "mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                          target.kind === "type" && t.id === selectedTypeId
                            ? "bg-secondary"
                            : "hover:bg-secondary/50",
                        )}
                      >
                        <Braces className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-foreground">{t.name}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">type alias</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            }
            trailing={
              <>
                {view === "excel" ? (
                  <StructureExcelEditor selectedId={selectedStructId} onSelectId={(id) => setTarget({ kind: "struct", id })} />
                ) : view === "ui" && target.kind === "type" && selectedType ? (
                  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-3xl px-5 py-5">
                      {selectedTypeIssues.length > 0 && (
                        <div className="mb-4 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                          {selectedTypeIssues.map((issue, i) => (
                            <p key={i} className="font-mono text-[11px] text-destructive">
                              {structureIssueMessage(issue, models)}
                            </p>
                          ))}
                        </div>
                      )}
                      <StructureTypeAliasEditor
                        alias={selectedType}
                        models={models}
                        typeAliases={typeAliases}
                        locked={false}
                        onUpdate={(patch) => updateTypeAlias(selectedType.id, patch)}
                        onDelete={() => deleteType(selectedType.id)}
                      />
                      <div className="mt-4">
                        <TypeAliasTextSync
                          alias={selectedType}
                          models={models}
                          locked={false}
                          onUpdate={(patch) => updateTypeAlias(selectedType.id, patch)}
                        />
                      </div>
                    </div>
                  </div>
                ) : view === "ui" && selected ? (
                  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-3xl px-5 py-5">
                      {selectedLocked && lockedStructureBanner(selected) && (
                        <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {lockedStructureBanner(selected)}
                          </p>
                        </div>
                      )}
                      {selected.sourceDocId && (
                        <div className="mb-4">
                          <StructureSourceDocLink sourceDocId={selected.sourceDocId} />
                        </div>
                      )}
                      {selectedStructIssues.length > 0 && (
                        <div className="mb-4 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                          {selectedStructIssues.map((issue, i) => (
                            <p key={i} className="font-mono text-[11px] text-destructive">
                              {structureIssueMessage(issue, models)}
                            </p>
                          ))}
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
                          <span className="w-20 text-center" title="optional · deterministic (= exact-tested, ≈ probabilistic/ignored)">
                            Opt · Det
                          </span>
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
                        Scalars and struct refs cover common fields. Define reusable shapes under Types in the sidebar — then pick them here as field types.
                      </p>
                    </div>
                  </div>
                ) : view === "code" ? (
                  <StructureTypesCodeSection models={models} typeAliases={typeAliases} />
                ) : (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-xs text-muted-foreground">No model selected.</p>
                  </div>
                )}
              </>
            }
          />
        )}
      </div>
    </div>
  )
}
