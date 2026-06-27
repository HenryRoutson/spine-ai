"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, FileText, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StepInputDescription, moduleInputDescription } from "@/components/step-input-description"
import { cn } from "@/lib/utils"
import {
  inputTypeAccept,
  inputTypeLabel,
  inputMinCountForModule,
  isMultiDocInputModule,
} from "@/lib/inference-input"
import type { DocId, DocRef, PipelineModule } from "@/lib/types"

export function SharedRunInputSlot({
  inputModule,
  defaultFilename,
  docs,
  uploading,
  issue,
  onUpload,
  onClear,
}: {
  inputModule: PipelineModule
  defaultFilename?: string
  docs: DocRef[]
  uploading: boolean
  issue?: { message: string }
  onUpload: (file: File) => void
  onClear: (docId: DocId) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const min = inputMinCountForModule(inputModule)
  const multi = isMultiDocInputModule(inputModule)
  const accept = inputTypeAccept(inputModule.inputType)

  return (
    <div className={cn("rounded-lg border bg-card p-3", issue ? "border-destructive/50" : "border-border")}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium">{inputModule.label}</span>
        <Badge variant="outline" className="font-mono text-[9px] capitalize">
          {inputTypeLabel(inputModule.inputType)}
        </Badge>
        {defaultFilename && !docs.length && (
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
            <div key={doc.id} className="flex items-center gap-2">
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5 font-mono text-[10px]">
                <FileText className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{doc.name}</span>
              </span>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => onClear(doc.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {multi && docs.length < min && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-transparent"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              Add file
            </Button>
          )}
        </div>
      ) : (
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
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ""
        }}
      />
      {issue && <p className="mt-2 font-mono text-[10px] text-destructive">{issue.message}</p>}
    </div>
  )
}
