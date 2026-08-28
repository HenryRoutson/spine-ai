"use client"
// AI : parity ids — structure.add-model structure.add-alias
// AI : TODO (spine-in-spine-bootstrap-S4-type-expr) — guest Structures page is {{table:StructureModel}}
// AI :   {{table:ModelField}} + {{slot:type-expr}} wrapping type-expr-editor. Do not port this panel.
// AI : TODO (spine-in-spine-full-F4-widgets) — full track mounts this panel as {{slot:structure}}.

// AI : TODO (spec) — per-structure "Quick summarise" button: cheap LLM flags inconsistencies (e.g. document_summary:int).
// AI : TODO (media-view-B-ui) — model header defaultView picker (builtin + project visualizers).
import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Code2, Sparkles, Lock, Braces, FileSpreadsheet, Loader2, Upload, KeyRound } from "lucide-react"
import { StructureExcelEditor } from "@/components/structure-excel-editor"
import { StructureTypeAliasEditor, TypeAliasTextSync } from "@/components/structure-type-alias-editor"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PreviewBlockedDialog } from "@/components/preview-blocked-dialog"
import { useAppShell } from "@/lib/app-shell"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { useStore, uid } from "@/lib/store"
import { StructureCodeView } from "@/components/structure-code-view"
import { StructureFunctionLinks } from "@/components/structure-function-links"
import { StructureRowsPanel } from "@/components/platform/structure-rows-panel"
import { IdInspector } from "@/components/id-inspector"
import { useProjectIdIndex } from "@/lib/use-project-id-index"
import { collectSqlIdTypes } from "@/lib/sql-id-types"
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
import { DocLabel, FieldType, InputType, type DocRef, type StructureModel, type StructureModelId, type TypeAlias } from "@/lib/types"
import { useLockedInteractFlash } from "@/lib/use-locked-interact-flash"
import { cn } from "@/lib/utils"
import { isPreviewOnly } from "@/lib/demo-mode"
import { docsForProject } from "@/lib/project-docs"
import { isTabularDocType } from "@/lib/doc-structure-infer"
import { mergeInferredStructuresForDoc, modelsChanged } from "@/lib/sync-doc-structures"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { inputTypeAccept } from "@/lib/inference-input"

type EditorTarget =
  | { kind: "struct"; id: string }
  | { kind: "type"; id: string }
  | { kind: "ids"; idType: string }

// AI : "structures" = spreadsheet editor; code lives in the sidebar menu, not per-struct.
type StructureView = "structures" | "code"

export function StructureBuilder() {
  useMarkPrimarySectionReady(AppPrimarySection.Build)
  const { models, setModels, typeAliases, setTypeAliases, project, docs, addDoc } = useStore()
  const { index: idIndex, loading: idIndexLoading } = useProjectIdIndex()
  const idTypes = useMemo(() => collectSqlIdTypes(models), [models])
  const teamReadOnly = !!project?.teamReadOnly
  const { focusStructureId, clearFocusStructure } = useAppShell()
  const [target, setTarget] = useState<EditorTarget>(() =>
    models[0]?.id ? { kind: "struct", id: models[0].id } : { kind: "struct", id: "" },
  )
  const [view, setView] = useState<StructureView>("structures")
  const savedSidebarWidth = useStructureSidebarWidth()
  const [sidebarWidth, setSidebarWidth] = useState(readStructureSidebarWidth)
  useEffect(() => setSidebarWidth(savedSidebarWidth), [savedSidebarWidth])
  const excelFileRef = useRef<HTMLInputElement>(null)
  const [deriving, setDeriving] = useState(false)
  const [deriveError, setDeriveError] = useState<string | null>(null)
  const [previewBlockedOpen, setPreviewBlockedOpen] = useState(false)
  // AI : after excel upload / derive, select the new combined (or sole) root struct.
  const selectAfterDeriveRef = useRef<Set<string> | null>(null)

  const selectedStructId = target.kind === "struct" ? target.id : models[0]?.id ?? ""
  const selectedTypeId = target.kind === "type" ? target.id : null

  const projectDocs = useMemo(() => (project ? docsForProject(docs, project) : []), [docs, project])
  const tabularDocs = useMemo(
    () => projectDocs.filter((d) => isTabularDocType(d.type, d.name)),
    [projectDocs],
  )

  // AI : jump here from JSON preview "validates as" links.
  useEffect(() => {
    if (!focusStructureId) return
    if (!models.some((m) => m.id === focusStructureId)) return
    setTarget({ kind: "struct", id: focusStructureId })
    setView("structures")
    clearFocusStructure()
  }, [focusStructureId, models, clearFocusStructure])

  useEffect(() => {
    const before = selectAfterDeriveRef.current
    if (!before) return
    const added = models.filter((m) => !before.has(m.id))
    if (!added.length) {
      // AI : upload finished with no new shapes (already present) — stop waiting.
      if (!deriving) selectAfterDeriveRef.current = null
      return
    }
    const referenced = new Set(
      added.flatMap((m) => m.fields.map((f) => f.ref).filter(Boolean) as string[]),
    )
    const roots = added.filter((m) => !referenced.has(m.id))
    const combined = roots.find((m) =>
      m.fields.some((f) => f.type === FieldType.ListModel && !!f.ref),
    )
    const pick = combined ?? roots[0] ?? added[0]
    if (!pick) return
    selectAfterDeriveRef.current = null
    setTarget({ kind: "struct", id: pick.id })
    setView("structures")
  }, [models, deriving])

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

  async function deriveFromUploadedExcel(file: File) {
    if (teamReadOnly || !project) return
    if (isPreviewOnly()) {
      setPreviewBlockedOpen(true)
      return
    }
    setDeriving(true)
    setDeriveError(null)
    selectAfterDeriveRef.current = new Set(models.map((m) => m.id))
    try {
      await addDoc(file, DocLabel.Inference, project.id)
    } catch (err) {
      selectAfterDeriveRef.current = null
      setDeriveError((err as Error).message || "Upload failed")
    } finally {
      setDeriving(false)
    }
  }

  async function deriveFromExistingDoc(doc: DocRef) {
    if (teamReadOnly) return
    if (isPreviewOnly()) {
      setPreviewBlockedOpen(true)
      return
    }
    setDeriving(true)
    setDeriveError(null)
    selectAfterDeriveRef.current = new Set(models.map((m) => m.id))
    try {
      const data = await fetchDocText(doc.id)
      const content = docTextContent(data)
      const merged = mergeInferredStructuresForDoc(
        models,
        doc,
        content,
        () => uid<StructureModelId>(),
      )
      if (!modelsChanged(models, merged)) {
        selectAfterDeriveRef.current = null
        setDeriveError("No new structures inferred from that file.")
        return
      }
      setModels(merged)
    } catch (err) {
      selectAfterDeriveRef.current = null
      setDeriveError((err as Error).message || "Could not derive structures")
    } finally {
      setDeriving(false)
    }
  }

  return (
    // AI : min-h-0 so flex parent can clip — without it content height blows past the viewport.
    <div className="flex h-full min-h-0 flex-col">
      {teamReadOnly && (
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Read-only team project — you can view and run, but not edit structures.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ResizableSplit
            className="h-full min-h-0 flex-1"
            leadingWidth={sidebarWidth}
            onLeadingWidthChange={setSidebarWidth}
            onLeadingWidthCommit={writeStructureSidebarWidth}
            minLeading={STRUCTURE_SIDEBAR_MIN}
            maxLeading={STRUCTURE_SIDEBAR_MAX}
            leading={
              <EntityRail className="h-full min-h-0 w-full flex-1">
                <EntityRailSection
                  title="Structs in project"
                  action={
                    <div className="flex items-center gap-0.5">
                      <input
                        ref={excelFileRef}
                        type="file"
                        className="hidden"
                        accept={inputTypeAccept([InputType.Excel, InputType.Json])}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ""
                          if (file) void deriveFromUploadedExcel(file)
                        }}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={teamReadOnly || deriving}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-6 px-1.5 font-mono text-[9px]",
                          )}
                          title="Derive struct from Excel / CSV / JSON"
                        >
                          {deriving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="h-3 w-3" />
                          )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="font-mono text-[10px]">
                              Derive from file
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              className="gap-2 font-mono text-xs"
                              onClick={() => excelFileRef.current?.click()}
                            >
                              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                              Upload Excel / CSV / JSON…
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          {tabularDocs.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <DropdownMenuLabel className="font-mono text-[10px]">
                                  Existing project files
                                </DropdownMenuLabel>
                                {tabularDocs.slice(0, 12).map((doc) => (
                                  <DropdownMenuItem
                                    key={doc.id}
                                    className="font-mono text-xs"
                                    title={doc.name}
                                    onClick={() => void deriveFromExistingDoc(doc)}
                                  >
                                    <span className="truncate">{doc.name}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuGroup>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 font-mono text-[9px]"
                        onClick={addStruct}
                        disabled={teamReadOnly}
                        spineId="structure.add-model"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  }
                  className="max-h-[45%] min-h-0"
                >
                  {deriveError && (
                    <p className="mb-1 px-1 font-mono text-[9px] text-destructive">{deriveError}</p>
                  )}
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
                      uiContext={{
                        kind: "model",
                        id: `model:${m.id}`,
                        label: `Structure · ${m.name}`,
                        snippet: m.description || `${m.fields.length} fields`,
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

                <EntityRailSection title="Row ids" className="max-h-[28%] min-h-0">
                  {idTypes.length === 0 && (
                    <p className="px-1 py-2 text-center font-mono text-[10px] text-muted-foreground">
                      set Key on a field
                    </p>
                  )}
                  {idTypes.map((t) => {
                    const bucket = idIndex.buckets.find((b) => b.idType === t.name)
                    return (
                      <EntityRailItem
                        key={t.name}
                        active={view === "structures" && target.kind === "ids" && target.idType === t.name}
                        onClick={() => {
                          setTarget({ kind: "ids", idType: t.name })
                          setView("structures")
                        }}
                      >
                        <div className="flex w-full items-center gap-1.5">
                          <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs text-foreground">{t.name}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {bucket
                                ? `${bucket.pkCount} pk · ${bucket.missing} missing`
                                : `${t.pkModelName}.${t.pkField}`}
                            </p>
                          </div>
                        </div>
                      </EntityRailItem>
                    )
                  })}
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
                      spineId="structure.add-alias"
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
                      uiContext={{
                        kind: "type_alias",
                        id: `type:${t.id}`,
                        label: `Type · ${t.name}`,
                        snippet: t.description,
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
                  <EntityRailItem active={view === "code"} onClick={() => setView("code")} spineId="structure.view-sql">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-mono text-xs text-foreground">Code preview</p>
                        <p className="font-mono text-[10px] text-muted-foreground">SQL · Python · TS</p>
                      </div>
                    </div>
                  </EntityRailItem>
                </div>
              </EntityRail>
            }
            trailing={
              <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {view === "code" ? (
                  <>
                    <StructureCodeView models={models} typeAliases={typeAliases} modules={project?.modules} />
                  </>
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
                ) : target.kind === "ids" ? (
                  <IdInspector
                    index={idIndex}
                    models={models}
                    idType={target.idType}
                    loading={idIndexLoading}
                  />
                ) : (
                  <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
                      {selectedStructId ? (
                        <StructureFunctionLinks modelId={selectedStructId as StructureModelId} />
                      ) : (
                        <span />
                      )}
                    </div>
                    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                      <StructureExcelEditor
                        selectedId={selectedStructId}
                        onSelectId={(id) => setTarget({ kind: "struct", id })}
                      />
                    </div>
                    {selectedStructId ? (
                      <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-border px-4 py-3">
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Stored rows
                        </p>
                        <StructureRowsPanel
                          models={models}
                          lockModelId={selectedStructId as StructureModelId}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            }
          />
      </div>
      {previewBlockedOpen ? <PreviewBlockedDialog onClose={() => setPreviewBlockedOpen(false)} /> : null}
    </div>
  )
}
