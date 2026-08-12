"use client"

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
}

type JsonStructMode = "file" | JsonStructFormKind

export function InferenceInputSlot(props: {
  inputModule: PipelineModule
  outModel?: string
  docs: DocRef[]
  issue?: { message: string }
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
    !!jsonStruct && !!onJsonStructAssigned && !upload && !multi && !!storeProps
  const [mode, setMode] = useState<JsonStructMode>("file")
  const [branchSeed, setBranchSeed] = useState<DocRef | null>(null)
  const clearSlot = storeProps?.onClearSlot
  const openPicker = storeProps?.onOpenPicker

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
        description={moduleInputDescription(inputModule)}
        forceVisible={!!issue}
        className="mb-2"
      />

      {jsonModes && (
        <div className="mb-3 flex flex-wrap gap-1 rounded-md border border-border bg-muted/20 p-1">
          {(
            [
              ["file", "From file"],
              ["branch", "Branch off"],
              ["empty", "Create empty"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={jsonStructDisabled}
              onClick={() => pickMode(id)}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
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
            >
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Choose file to branch from
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
                <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5 font-mono text-[10px]">
                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{doc.name}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => storeProps!.onOpenDoc(doc.id)}
                  className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5 font-mono text-[10px] transition-colors hover:border-primary/40 hover:bg-primary/5"
                  title="Preview selected document"
                >
                  <Link2 className="h-3 w-3 shrink-0 text-primary" />
                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{doc.name}</span>
                </button>
              )}
              {(multi || upload) && (uploadProps?.onRemoveDoc ?? storeProps?.onRemoveDoc) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() =>
                    upload
                      ? uploadProps!.onRemoveDoc(doc.id)
                      : storeProps!.onRemoveDoc!(doc.id)
                  }
                >
                  {upload ? <X className="h-3.5 w-3.5" /> : "Remove"}
                </Button>
              )}
            </div>
          ))}
          {multi && !upload && (
            <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={storeProps!.onOpenPicker}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Add document
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
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Change
            </Button>
          )}
        </div>
      ) : upload ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-transparent"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" />
          )}
          {defaultFilename ? "Upload to replace default" : "Upload file"}
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={storeProps!.onOpenPicker}>
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Choose from store
        </Button>
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
        <p className="mt-2 font-mono text-[10px] text-destructive">{issue.message}</p>
      )}
    </div>
  )
}
