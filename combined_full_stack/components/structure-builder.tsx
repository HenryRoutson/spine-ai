"use client"

// AI : TODO (spec) — per-structure "Quick summarise" button: cheap LLM flags inconsistencies (e.g. document_summary:int).
import { useEffect, useMemo, useState } from "react"
import { Plus, Code2, Sparkles, Lock, Braces } from "lucide-react"
import { StructureExcelEditor } from "@/components/structure-excel-editor"
import { StructureTypeAliasEditor, TypeAliasTextSync } from "@/components/structure-type-alias-editor"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAppShell } from "@/lib/app-shell"
import { useStore, uid } from "@/lib/store"
import { StructureCodeView } from "@/components/structure-code-view"
import { ResizableSplit } from "@/components/resizable-split"
import {
  readStructureSidebarWidth,
  STRUCTURE_SIDEBAR_MAX,
  STRUCTURE_SIDEBAR_MIN,
  useStructureSidebarWidth,
  writeStructureSidebarWidth,
} from "@/lib/editor-split-settings"
import { isLockedStructureModel, isLockedTypeAlias, lockedTypeAliasBanner } from "@/lib/structure"
import { computeStructureIssues, structureIssueMessage } from "@/lib/structure-validity"
import { UNSET_TYPE_EXPR } from "@/lib/server/type_expr"
import { FieldType, type StructureModel, type TypeAlias } from "@/lib/types"
import { useLockedInteractFlash } from "@/lib/use-locked-interact-flash"
import { cn } from "@/lib/utils"

type EditorTarget =
  | { kind: "struct"; id: string }
  | { kind: "type"; id: string }

// AI : "structures" = spreadsheet editor; code lives in the sidebar menu, not per-struct.
type StructureView = "structures" | "code"

export function StructureBuilder() {
  const { models, setModels, typeAliases, setTypeAliases, project } = useStore()
  const teamReadOnly = !!project?.teamReadOnly
  const { focusStructureId, clearFocusStructure } = useAppShell()
  const [target, setTarget] = useState<EditorTarget>(() =>
    models[0]?.id ? { kind: "struct", id: models[0].id } : { kind: "struct", id: "" },
  )
  const [view, setView] = useState<StructureView>("structures")
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
    setView("structures")
    clearFocusStructure()
  }, [focusStructureId, models, clearFocusStructure])

  const selectedType = typeAliases.find((t) => t.id === selectedTypeId)
  const selectedTypeLocked = teamReadOnly || (selectedType ? isLockedTypeAlias(selectedType) : false)
  const typeLockMessage = teamReadOnly
    ? "Read-only team project — you can view and run, but not edit types."
    : selectedType
      ? lockedTypeAliasBanner(selectedType)
      : null
  const {
    flash: typeLockFlash,
    bannerRef: typeLockBannerRef,
    notifyLocked: notifyTypeLocked,
  } = useLockedInteractFlash(typeLockMessage, selectedTypeId ?? "")
  const structureIssues = useMemo(
    () => computeStructureIssues(models, typeAliases),
    [models, typeAliases],
  )
  const selectedTypeIssues = useMemo(() => {
    if (!selectedType) return []
    const name = selectedType.name.trim()
    return structureIssues.filter(
      (i) => i.aliasName === name || i.aliasName?.startsWith(`${name} → `),
    )
  }, [structureIssues, selectedType])

  function addStruct() {
    if (teamReadOnly) return
    const m: StructureModel = {
      id: uid(),
      name: "NewStruct",
      description: "",
      fields: [{ id: uid(), name: "field", type: FieldType.Text, optional: false, description: "" }],
    }
    setModels([...models, m])
    setTarget({ kind: "struct", id: m.id })
    setView("structures")
  }

  function addType() {
    if (teamReadOnly) return
    const t: TypeAlias = {
      id: uid(),
      name: "NewType",
      description: "",
      expr: UNSET_TYPE_EXPR,
    }
    setTypeAliases([...typeAliases, t])
    setTarget({ kind: "type", id: t.id })
    setView("structures")
  }

  function deleteType(id: string) {
    if (teamReadOnly) return
    const alias = typeAliases.find((t) => t.id === id)
    if (alias && isLockedTypeAlias(alias)) return
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
    if (teamReadOnly) return
    setTypeAliases((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="01 / Structure"
        title="Structures"
        description="Define the pydantic models your LLM must output to. Schema validation is implicit on every step's I/O."
      />

      {teamReadOnly && (
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Read-only team project — you can view and run, but not edit structures.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
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
                    disabled={teamReadOnly}
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
                      onClick={() => {
                        setTarget({ kind: "struct", id: m.id })
                        setView("structures")
                      }}
                      className={cn(
                        "group mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors",
                        view === "structures" && target.kind === "struct" && m.id === selectedStructId
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
                    disabled={teamReadOnly}
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
                          setView("structures")
                        }}
                        className={cn(
                          "mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                          view === "structures" && target.kind === "type" && t.id === selectedTypeId
                            ? "bg-secondary"
                            : "hover:bg-secondary/50",
                        )}
                      >
                        <Braces className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-foreground">{t.name}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">type alias</p>
                        </div>
                        {isLockedTypeAlias(t) && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI : code is project-wide (all structs/types), not tied to one selected struct */}
                <div className="mt-auto border-t border-border px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setView("code")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                      view === "code" ? "bg-secondary" : "hover:bg-secondary/50",
                    )}
                  >
                    <Code2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-foreground">Code</p>
                      <p className="font-mono text-[10px] text-muted-foreground">Python · TS · Rust</p>
                    </div>
                  </button>
                </div>
              </aside>
            }
            trailing={
              <>
                {view === "code" ? (
                  <StructureCodeView models={models} typeAliases={typeAliases} />
                ) : target.kind === "type" && selectedType ? (
                  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-3xl px-5 py-5">
                      {selectedTypeLocked && typeLockMessage && (
                        <div
                          ref={typeLockBannerRef}
                          role={typeLockFlash ? "alert" : "status"}
                          className={cn(
                            "mb-4 flex items-start gap-2 rounded-md border px-3 py-2 transition-colors",
                            typeLockFlash
                              ? "border-destructive/50 bg-destructive/15"
                              : "border-border bg-secondary/40",
                          )}
                        >
                          <Lock
                            className={cn(
                              "mt-0.5 h-3.5 w-3.5 shrink-0",
                              typeLockFlash ? "text-destructive" : "text-muted-foreground",
                            )}
                          />
                          <p
                            className={cn(
                              "font-mono text-[11px]",
                              typeLockFlash ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {typeLockMessage}
                          </p>
                        </div>
                      )}
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
                        locked={selectedTypeLocked}
                        onLockedInteract={notifyTypeLocked}
                        onUpdate={(patch) => updateTypeAlias(selectedType.id, patch)}
                        onDelete={() => deleteType(selectedType.id)}
                      />
                      <div className="mt-4">
                        <TypeAliasTextSync
                          alias={selectedType}
                          models={models}
                          locked={selectedTypeLocked}
                          onLockedInteract={notifyTypeLocked}
                          onUpdate={(patch) => updateTypeAlias(selectedType.id, patch)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <StructureExcelEditor
                    selectedId={selectedStructId}
                    onSelectId={(id) => setTarget({ kind: "struct", id })}
                  />
                )}
              </>
            }
          />
      </div>
    </div>
  )
}
