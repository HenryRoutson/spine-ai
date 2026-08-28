"use client"
// AI : parity ids — inference.assign-input

import { useEffect, useRef, useState } from "react"
import { FileText, FolderOpen, Link2, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  InferenceJsonStructEditor,
  type InferenceJsonStructDocSource,
  type JsonStructFormKind,
} from "@/components/inference/inference-json-struct-editor"
import { StepInputDescription, moduleInputDescription } from "@/components/step-input-description"
import { simpleStepDescription, toPlainIssueMessage } from "@/lib/plain-step-description"
import { cn } from "@/lib/utils"
import {
  inputTypeAccept,
  inputTypeLabel,
  inputNameRestrictionLabel,
  inputMinCountForModule,
  isMultiDocInputModule,
} from "@/lib/inference-input"
import type { InferenceJsonStructSchema } from "@/lib/inference-json-struct-edit"
import type { DocId, DocRef, PipelineModule } from "@/lib/types"
import { uiContextTargetProps } from "@/lib/ui-context-dom"

type StoreSlotProps = {
  variant?: "store"
  onOpenPicker: () => void
  onOpenDoc: (docId: DocId) => void
  onRemoveDoc?: (docId: DocId) => void
  onClearSlot?: () => void
}

type UploadSlotProps = {
  variant: "upload"
  defaultFilename?: string
  uploading?: boolean
  onUpload: (file: File) => void
  onRemoveDoc: (docId: DocId) => void
  onClearSlot?: () => void
}

type JsonStructMode = "file" | JsonStructFormKind

export function InferenceInputSlot(props: {
  inputModule: PipelineModule
  outModel?: string
  docs: DocRef[]
  issue?: { message: string }
  simple?: boolean
  // AI : JSON + typed structureOut — exclusive: from file | branch | create empty.
  jsonStruct?: InferenceJsonStructSchema | null
  jsonStructDisabled?: boolean
  onJsonStructAssigned?: (doc: DocRef) => void
  // AI : required when rendered outside StoreProvider (consumer share/run shell).
  jsonStructSource?: InferenceJsonStructDocSource
} & (StoreSlotProps | UploadSlotProps)) {
  const {
    inputModule,
    outModel,
    docs,
    issue,
    simple = false,
    jsonStruct = null,
    jsonStructDisabled = false,
    onJsonStructAssigned,
    jsonStructSource,
    variant = "store",
    ...rest
  } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const min = inputMinCountForModule(inputModule)
  const multi = isMultiDocInputModule(inputModule)
  const upload = variant === "upload"
  const uploadProps = upload ? (rest as Omit<UploadSlotProps, "variant">) : null
  const storeProps = !upload ? (rest as Omit<StoreSlotProps, "variant">) : null
  const defaultFilename = uploadProps?.defaultFilename
  const uploading = uploadProps?.uploading ?? false

  // AI : exclusive modes — never stack file chip + form (that looked like in-place file edit).
  const jsonModes =
    !!jsonStruct &&
    !!onJsonStructAssigned &&
    inputMinCountForModule(inputModule) === 1 &&
    (upload ? !!jsonStructSource : !!storeProps)
  const [mode, setMode] = useState<JsonStructMode>("file")
  const [branchSeed, setBranchSeed] = useState<DocRef | null>(null)
  const clearSlot = uploadProps?.onClearSlot ?? storeProps?.onClearSlot
  const openPicker = storeProps?.onOpenPicker

  useEffect(() => {
    if (simple && mode === "branch") {
      setBranchSeed(null)
      setMode("file")
    }
  }, [simple, mode])

  useEffect(() => {
    // AI : picker assigns into docs — while branching with no seed yet, copy then clear so the form isn't "editing" that file.
    if (mode !== "branch" || branchSeed || !docs[0] || !clearSlot) return
    setBranchSeed(docs[0])
    clearSlot()
  }, [mode, branchSeed, docs, clearSlot])

  function pickMode(next: JsonStructMode) {
    if (next === mode || jsonStructDisabled) return
    if (next === "file") {
      setBranchSeed(null)
      setMode("file")
      return
    }
    if (next === "branch") {
      const seed = docs[0] ?? null
      setBranchSeed(seed)
      if (docs.length) clearSlot?.()
      setMode("branch")
      return
    }
    setBranchSeed(null)
    if (docs.length) clearSlot?.()
    setMode("empty")
  }

  const rawDescription = moduleInputDescription(inputModule)
  const description = simple ? simpleStepDescription(rawDescription, inputModule.kind) : rawDescription
  const jsonModeTabs = upload
    ? ([["file", "Upload JSON"], ["empty", "Fill in a form"]] as const)
    : simple
      ? ([["file", "Choose file"], ["empty", "Fill in a form"]] as const)
      : ([["file", "From file"], ["branch", "Branch off"], ["empty", "Create empty"]] as const)
  // AI : empty file picker — in simple mode sit square beside the label, not a full-width bar.
  const emptyFileSlot = docs.length === 0 && (!jsonModes || mode === "file")
  const emptyPickerLabel = upload
    ? defaultFilename
      ? simple
        ? "Upload a different file"
        : "Upload to replace default"
      : "Upload file"
    : simple
      ? "Choose file"
      : "Choose from store"

  // AI : simple view always offers unassign; advanced keeps remove for multi/upload only.
  const onRemoveAssigned = uploadProps?.onRemoveDoc ?? storeProps?.onRemoveDoc

  function emptyPickerButton(compact: boolean) {
    return (
      <Button
        variant="outline"
        size={compact ? "icon-sm" : "sm"}
        className={compact ? "shrink-0 bg-transparent" : "w-full bg-transparent"}
        disabled={upload && uploading}
        onClick={upload ? () => inputRef.current?.click() : storeProps!.onOpenPicker}
        aria-label={emptyPickerLabel}
        title={compact ? emptyPickerLabel : undefined}
      >
        {upload && uploading ? (
          <Loader2 className={cn("h-3.5 w-3.5 animate-spin", !compact && "mr-1.5")} />
        ) : upload ? (
          <Upload className={cn("h-3.5 w-3.5", !compact && "mr-1.5")} />
        ) : (
          <FolderOpen className={cn("h-3.5 w-3.5", !compact && "mr-1.5")} />
        )}
        {!compact && emptyPickerLabel}
      </Button>
    )
  }

  function removeFileButton(docId: DocId, compact: boolean) {
    if (!onRemoveAssigned) return null
    return (
      <Button
        variant={compact ? "outline" : "ghost"}
        size={compact ? "icon-sm" : "sm"}
        className={compact ? "shrink-0 bg-transparent" : "h-8"}
        onClick={() => onRemoveAssigned(docId)}
        aria-label="Remove file"
        title={compact ? "Remove file" : undefined}
      >
        {compact || upload ? <X className="h-3.5 w-3.5" /> : "Remove"}
      </Button>
    )
  }

  return (
    <div
      className={cn("rounded-lg border bg-card p-3", issue ? "border-destructive/50" : "border-border")}
      {...uiContextTargetProps({
        kind: "pipeline_step",
        id: `step:${inputModule.id}`,
        label: `Input · ${inputModule.label}`,
        moduleId: inputModule.id,
        snippet: [
          inputTypeLabel(inputModule.inputType),
          outModel ? `→ ${outModel}${multi ? "[]" : ""}` : null,
          jsonModes ? `mode:${mode}` : null,
          docs.length ? `${docs.length} doc(s): ${docs.map((d) => d.name).join(", ")}` : "no docs assigned",
          issue?.message ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
      })}
    >
      {simple ? (
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{inputModule.label}</p>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {emptyFileSlot ? emptyPickerButton(true) : null}
        </div>
      ) : (
        <>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium">{inputModule.label}</span>
        <Badge variant="outline" className="font-mono text-[9px] capitalize">
          {inputTypeLabel(inputModule.inputType)}
        </Badge>
        {multi && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            min {min} doc{min === 1 ? "" : "s"}
          </Badge>
        )}
        {inputNameRestrictionLabel(inputModule) && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            name ∋ "{inputNameRestrictionLabel(inputModule)}"
          </Badge>
        )}
        {outModel && (
          <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
            → {outModel}{multi ? "[]" : ""}
          </Badge>
        )}
        {upload && defaultFilename && !docs.length && (
          <Badge variant="secondary" className="font-mono text-[9px]">
            default: {defaultFilename}
          </Badge>
        )}
      </div>
      <StepInputDescription
        description={description}
        forceVisible={!!issue}
        className="mb-2"
      />
        </>
      )}

      {jsonModes && (
        <div className="mb-3 flex flex-wrap gap-1 rounded-md border border-border bg-muted/20 p-1">
          {jsonModeTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={jsonStructDisabled}
              onClick={() => pickMode(id)}
              className={cn(
                "rounded px-2.5 py-1 text-[10px] transition-colors",
                !simple && "font-mono",
                mode === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {jsonModes && mode !== "file" ? (
        <div className="space-y-2">
          {mode === "branch" && !branchSeed && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full bg-transparent"
              disabled={jsonStructDisabled}
              onClick={openPicker}
              spineId="inference.assign-input"
            >
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> {simple ? "Choose a file to start from" : "Choose file to branch from"}
            </Button>
          )}
          {(mode === "empty" || branchSeed) && (
            <InferenceJsonStructEditor
              key={`${mode}:${branchSeed?.id ?? "new"}`}
              kind={mode}
              schema={jsonStruct!.schema}
              modelName={jsonStruct!.modelName}
              seedDoc={mode === "branch" ? branchSeed : null}
              disabled={jsonStructDisabled}
              onAssigned={onJsonStructAssigned!}
              source={jsonStructSource}
              plain={simple}
            />
          )}
          {mode === "branch" && branchSeed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 font-mono text-[10px] text-muted-foreground"
              disabled={jsonStructDisabled}
              onClick={() => {
                setBranchSeed(null)
                clearSlot?.()
                openPicker?.()
              }}
            >
              Change branch source
            </Button>
          )}
        </div>
      ) : docs.length ? (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center gap-2">
              {upload ? (
                <span
                  className={cn("inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5", simple ? "text-xs" : "font-mono text-[10px]")}
                  {...uiContextTargetProps({
                    kind: "project_doc",
                    id: `doc:${doc.id}`,
                    label: `File · ${doc.name}`,
                    snippet: doc.name,
                  })}
                >
                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{doc.name}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => storeProps!.onOpenDoc(doc.id)}
                  className={cn(
                    "inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5 transition-colors hover:border-primary/40 hover:bg-primary/5",
                    simple ? "text-xs" : "font-mono text-[10px]",
                  )}
                  title="Preview selected document"
                  {...uiContextTargetProps({
                    kind: "project_doc",
                    id: `doc:${doc.id}`,
                    label: `File · ${doc.name}`,
                    snippet: doc.name,
                  })}
                >
                  <Link2 className="h-3 w-3 shrink-0 text-primary" />
                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{doc.name}</span>
                </button>
              )}
              {(multi || upload || simple) && removeFileButton(doc.id, simple)}
            </div>
          ))}
          {multi && !upload && (
            <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={storeProps!.onOpenPicker}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> {simple ? "Add file" : "Add document"}
            </Button>
          )}
          {multi && upload && docs.length < min && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-transparent"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add file
            </Button>
          )}
          {!multi && !upload && (
            <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={storeProps!.onOpenPicker}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> {simple ? "Change file" : "Change"}
            </Button>
          )}
        </div>
      ) : simple ? null : (
        emptyPickerButton(false)
      )}
      {upload && (
        <input
          ref={inputRef}
          type="file"
          accept={inputTypeAccept(inputModule.inputType)}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadProps!.onUpload(file)
            e.target.value = ""
          }}
        />
      )}
      {issue && (
        <p className={cn("mt-2 text-destructive", simple ? "text-sm" : "font-mono text-[10px]")}>
          {simple ? toPlainIssueMessage(issue.message) : issue.message}
        </p>
      )}
    </div>
  )
}
