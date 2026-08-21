"use client"

import { useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  X,
  Search,
  Eye,
  FileText,
  FileSpreadsheet,
  FileJson,
  Globe,
  ImageIcon,
  Hash,
  UploadCloud,
  Check,
  Ban,
  TriangleAlert,
} from "lucide-react"
import { useOptionalStore } from "@/lib/store"
import { formatSizeKb } from "@/lib/doc-size"
import { useDocViewer } from "@/lib/doc-viewer"
import {
  passableDocsForInputModule,
  excludedDocsForInputModule,
  exclusionReasonLabel,
  inputTypeLabel,
  inputTypeAccept,
  inputNameRestrictionLabel,
} from "@/lib/inference-input"
import { modelName } from "@/lib/validity"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PreviewBlockedDialog } from "@/components/preview-blocked-dialog"
import { Input } from "@/components/ui/input"
import { confidentialUploadWarning } from "@/lib/confidential-upload"
import { isPreviewOnly } from "@/lib/demo-mode"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/time-ago"
import { DocLabel } from "@/lib/types"
import type { DocId, DocRef, InputType, PipelineModule, Project, StructureModel } from "@/lib/types"

export type InferencePickerSource = {
  docs: DocRef[]
  project: Project
  models: StructureModel[]
  addDoc: (file: File, label: DocLabel, projectId?: string) => Promise<DocRef>
}

const TYPE_ICON: Record<InputType, typeof FileText> = {
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  json: FileJson,
  text: FileText,
  markdown: FileText,
  latex: FileText,
  web: Globe,
  image: ImageIcon,
}

export function InferenceInputPickerPopup({
  inputModule,
  selectedDocIds = [],
  onSelect,
  onClose,
  source,
  simple = false,
}: {
  inputModule: PipelineModule
  selectedDocIds?: DocId[]
  onSelect: (doc: DocRef) => void
  onClose: () => void
  source?: InferencePickerSource
  simple?: boolean
}) {
  const store = useOptionalStore()
  const docs = source?.docs ?? store?.docs ?? []
  const workspaceProject = source?.project ?? store?.project
  const models = source?.models ?? store?.models ?? []
  const workspaceAddDoc = source?.addDoc ?? store?.addDoc
  const pickerReady = workspaceProject != null && workspaceAddDoc != null
  const { open } = useDocViewer()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null)
  const [previewBlockedOpen, setPreviewBlockedOpen] = useState(false)

  const passable = useMemo(
    () =>
      pickerReady
        ? passableDocsForInputModule(docs, workspaceProject, inputModule)
        : [],
    [docs, workspaceProject, inputModule, pickerReady],
  )
  const excluded = useMemo(
    () =>
      pickerReady ? excludedDocsForInputModule(docs, workspaceProject, inputModule) : [],
    [docs, workspaceProject, inputModule, pickerReady],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return passable
    return passable.filter((d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q))
  }, [passable, query])
  const filteredExcluded = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return excluded
    return excluded.filter(
      ({ doc }) => doc.name.toLowerCase().includes(q) || doc.id.toLowerCase().includes(q),
    )
  }, [excluded, query])

  const outModel = modelName(models, inputModule.outStructureId)

  const nameRestriction = inputNameRestrictionLabel(inputModule)

  async function ingest(files: FileList | null) {
    if (!files?.length || !pickerReady) return
    if (isPreviewOnly()) {
      setPreviewBlockedOpen(true)
      return
    }
    const blocked = confidentialUploadWarning(files[0].name)
    if (blocked) {
      setUploadWarning(blocked)
      setTimeout(() => setUploadWarning(null), 6000)
      return
    }
    setUploading(true)
    try {
      const doc = await workspaceAddDoc(files[0], DocLabel.Inference, workspaceProject.id)
      if (passableDocsForInputModule([doc], workspaceProject, inputModule).some((d) => d.id === doc.id)) {
        onSelect(doc)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : null
      if (msg && confidentialUploadWarning(files[0].name)) {
        setUploadWarning(msg)
        setTimeout(() => setUploadWarning(null), 6000)
      } else {
        console.error(e)
      }
    } finally {
      setUploading(false)
    }
  }

  if (!pickerReady) return null

  return (
    <>
      {createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close document picker"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(42rem,88vh)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn(simple ? "text-xs text-muted-foreground" : "font-mono text-[10px] uppercase tracking-wider text-muted-foreground")}>
                {simple ? "Choose a file" : "choose input document"}
              </p>
              <h3 className="truncate text-sm font-semibold">{inputModule.label}</h3>
              {simple ? null : (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-[9px] capitalize">
                  {inputTypeLabel(inputModule.inputType)}
                </Badge>
                {outModel && (
                  <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                    → {outModel}
                  </Badge>
                )}
                {nameRestriction && (
                  <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                    name contains "{nameRestriction}"
                  </Badge>
                )}
              </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-border px-4 py-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={simple ? "Search files…" : "Search matching documents…"}
              className={cn("h-8 pl-8 text-xs", !simple && "font-mono")}
            />
          </div>
        </div>

        <div className="shrink-0 border-b border-border px-4 py-2">
          <div
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border py-2.5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            {uploading ? (
              <span className="font-mono text-[10px] text-muted-foreground">Uploading…</span>
            ) : (
              <>
                <UploadCloud className="h-4 w-4 text-muted-foreground" />
                <span className={cn("text-muted-foreground", simple ? "text-xs" : "font-mono text-[10px]")}>
                {simple ? "Upload a file" : `Upload ${inputTypeLabel(inputModule.inputType)} to store`}
              </span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={inputTypeAccept(inputModule.inputType)}
              className="hidden"
              onChange={(e) => void ingest(e.target.files)}
            />
          </div>
          {uploadWarning && (
            <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-destructive">
              <TriangleAlert className="h-3 w-3 shrink-0" /> {uploadWarning}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {passable.length === 0 && excluded.length === 0 ? (
            <p className={cn("px-4 py-8 text-center text-muted-foreground", simple ? "text-sm" : "font-mono text-[11px]")}>
              {simple
                ? "No files yet. Upload one above."
                : `No ${inputTypeLabel(inputModule.inputType)}${
                    nameRestriction ? ` documents with "${nameRestriction}" in the name` : " documents"
                  } in the store for this project.`}
            </p>
          ) : filtered.length === 0 && filteredExcluded.length === 0 ? (
            <p className={cn("px-4 py-8 text-center text-muted-foreground", simple ? "text-sm" : "font-mono text-[11px]")}>
              {simple ? "No files match your search." : "No documents match your search."}
            </p>
          ) : (
            <div className="p-2">
              {filtered.length > 0 && (
                <ul className="divide-y divide-border">
                  {filtered.map((doc) => {
                    const Icon = TYPE_ICON[doc.type]
                    const selected = selectedDocIds.includes(doc.id)
                    return (
                      <li
                        key={doc.id}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-2.5",
                          selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent",
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-medium">{doc.name}</span>
                            {selected && (
                              <Badge className="h-4 bg-primary/15 px-1 font-mono text-[9px] text-primary hover:bg-primary/15">
                                selected
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-muted-foreground">
                            {simple ? (
                              <span className="text-[11px]">
                                {formatSizeKb(doc.sizeKb)} · {timeAgo(doc.uploadedAt)}
                              </span>
                            ) : (
                              <span className="flex items-center gap-2 font-mono text-[10px]">
                                <span className="flex items-center gap-1">
                                  <Hash className="h-2.5 w-2.5" />
                                  {doc.id}
                                </span>
                                <span>{formatSizeKb(doc.sizeKb)}</span>
                                <span>{timeAgo(doc.uploadedAt)}</span>
                              </span>
                            )}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => open({ docId: doc.id, start: 0, end: 0 })}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                        </Button>
                        <Button
                          size="sm"
                          className="shrink-0"
                          onClick={() => onSelect(doc)}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" /> Use
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {simple ? null : filteredExcluded.length > 0 && (
                <div className={cn(filtered.length > 0 && "mt-3 border-t border-border pt-3")}>
                  <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    excluded · {filteredExcluded.length} document{filteredExcluded.length === 1 ? "" : "s"}
                  </p>
                  <ul className="divide-y divide-border/60">
                    {filteredExcluded.map(({ doc, reason }) => {
                      const Icon = TYPE_ICON[doc.type]
                      return (
                        <li
                          key={doc.id}
                          className="flex items-center gap-3 rounded-md px-2 py-2.5 opacity-55"
                          title={exclusionReasonLabel(reason, inputModule)}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs font-medium text-muted-foreground line-through decoration-muted-foreground/50">
                                {doc.name}
                              </span>
                              <Badge
                                variant="outline"
                                className="h-4 shrink-0 border-destructive/30 bg-destructive/5 px-1 font-mono text-[9px] text-destructive/80"
                              >
                                <Ban className="mr-0.5 h-2.5 w-2.5" />
                                excluded
                              </Badge>
                            </div>
                            <p className="mt-0.5 font-mono text-[10px] text-destructive/70">
                              {exclusionReasonLabel(reason, inputModule)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-muted-foreground"
                            onClick={() => open({ docId: doc.id, start: 0, end: 0 })}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {simple || !(passable.length === 0 && filteredExcluded.length > 0) ? null : (
                <p className="px-2 pb-2 pt-1 text-center font-mono text-[10px] text-muted-foreground">
                  No documents pass this input&apos;s rules — upload or rename a file to match
                  {nameRestriction ? ` "${nameRestriction}"` : ""}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
      )}
      {previewBlockedOpen ? <PreviewBlockedDialog onClose={() => setPreviewBlockedOpen(false)} /> : null}
    </>
  )
}
