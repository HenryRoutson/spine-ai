"use client"

// AI : TODO (spec) — per-structure "Quick summarise" button: cheap LLM flags inconsistencies (e.g. document_summary:int).
import { useEffect, useMemo, useState } from "react"
import { Plus, Code2, Sparkles, Lock, Braces } from "lucide-react"
import { StructureExcelEditor } from "@/components/structure-excel-editor"
import { StructureTypeAliasEditor, TypeAliasTextSync } from "@/components/structure-type-alias-editor"
import { WindowHeader } from "@/components/window-header"
import { windowPanelHeader } from "@/lib/window-panel-meta"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAppShell } from "@/lib/app-shell"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { useStore, uid } from "@/lib/store"
import { StructureCodeView } from "@/components/structure-code-view"
import { EntityRail, EntityRailItem, EntityRailSection } from "@/components/entity-rail"
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
  useMarkPrimarySectionReady(AppPrimarySection.Build)
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

  const structurePanel = windowPanelHeader("structure")

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step={structurePanel.step}
        title={structurePanel.title}
        description={structurePanel.description}
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
              <EntityRail className="min-h-0 w-full flex-1">
                <EntityRailSection
                  title="Structs in project"
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 font-mono text-[9px]"
                      onClick={addStruct}
                      disabled={teamReadOnly}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  }
                  className="max-h-[45%] shrink-0"
                >
                  {models.length === 0 && (
                    <p className="px-1 py-2 text-center font-mono text-[10px] text-muted-foreground">
                      no structs yet
                    </p>
                  )}
                  {models.map((m) => (
                    <EntityRailItem
                      key={m.id}
                      active={view === "structures" && target.kind === "struct" && m.id === selectedStructId}
                      onClick={() => {
                        setTarget({ kind: "struct", id: m.id })
                        setView("structures")
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <div className="min-w-0">
                          <p className="break-all font-mono text-xs text-foreground">{m.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{m.fields.length} fields</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {m.auto && <Sparkles className="h-3 w-3 text-chart-3" />}
                          {m.sourceDocId && (
                            <Badge variant="outline" className="h-4 px-1 font-mono text-[8px]">
                              doc
                            </Badge>
                          )}
                          {isLockedStructureModel(m) && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </EntityRailItem>
                  ))}
                </EntityRailSection>

                <EntityRailSection
                  title="Type aliases"
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 font-mono text-[9px]"
                      onClick={addType}
                      disabled={teamReadOnly}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  }
                  className="min-h-0 flex-1"
                >
                  {typeAliases.length === 0 && (
                    <p className="px-1 py-2 text-center font-mono text-[10px] text-muted-foreground">
                      no types yet
                    </p>
                  )}
                  {typeAliases.map((t) => (
                    <EntityRailItem
                      key={t.id}
                      active={view === "structures" && target.kind === "type" && t.id === selectedTypeId}
                      onClick={() => {
                        setTarget({ kind: "type", id: t.id })
                        setView("structures")
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Braces className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-foreground">{t.name}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">type alias</p>
                        </div>
                        {isLockedTypeAlias(t) && <Lock className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />}
                      </div>
                    </EntityRailItem>
                  ))}
                </EntityRailSection>

                <div className="shrink-0 border-t border-border/60 p-1.5">
                  <EntityRailItem active={view === "code"} onClick={() => setView("code")}>
                    <div className="flex items-center gap-2">
                      <Code2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-mono text-xs text-foreground">Code preview</p>
                        <p className="font-mono text-[10px] text-muted-foreground">Python · TS · Rust</p>
                      </div>
                    </div>
                  </EntityRailItem>
                </div>
              </EntityRail>
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
