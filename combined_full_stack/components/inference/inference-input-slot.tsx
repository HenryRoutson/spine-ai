"use client"

import { useRef } from "react"
import { FileText, FolderOpen, Link2, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StepInputDescription, moduleInputDescription } from "@/components/step-input-description"
import { cn } from "@/lib/utils"
import {
  inputTypeAccept,
  inputTypeLabel,
  inputNameRestrictionLabel,
  inputMinCountForModule,
  isMultiDocInputModule,
} from "@/lib/inference-input"
import type { DocId, DocRef, PipelineModule } from "@/lib/types"

type StoreSlotProps = {
  variant?: "store"
  onOpenPicker: () => void
  onOpenDoc: (docId: DocId) => void
  onRemoveDoc?: (docId: DocId) => void
}

type UploadSlotProps = {
  variant: "upload"
  defaultFilename?: string
  uploading?: boolean
  onUpload: (file: File) => void
  onRemoveDoc: (docId: DocId) => void
}

export function InferenceInputSlot(props: {
  inputModule: PipelineModule
  outModel?: string
  docs: DocRef[]
  issue?: { message: string }
} & (StoreSlotProps | UploadSlotProps)) {
  const { inputModule, outModel, docs, issue, variant = "store", ...rest } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const min = inputMinCountForModule(inputModule)
  const multi = isMultiDocInputModule(inputModule)
  const upload = variant === "upload"
  const uploadProps = upload ? (rest as Omit<UploadSlotProps, "variant">) : null
  const storeProps = !upload ? (rest as Omit<StoreSlotProps, "variant">) : null
  const defaultFilename = uploadProps?.defaultFilename
  const uploading = uploadProps?.uploading ?? false

  return (
    <div className={cn("rounded-lg border bg-card p-3", issue ? "border-destructive/50" : "border-border")}>
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
      {docs.length ? (
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
