"use client"

import { FileText, FolderOpen, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StepInputDescription, moduleInputDescription } from "@/components/step-input-description"
import { cn } from "@/lib/utils"
import {
  inputTypeLabel,
  inputNameRestrictionLabel,
  inputMinCountForModule,
  isMultiDocInputModule,
} from "@/lib/inference-input"
import type { DocId, DocRef, PipelineModule } from "@/lib/types"

export function InferenceInputSlot({
  inputModule,
  outModel,
  docs,
  issue,
  onOpenPicker,
  onOpenDoc,
  onRemoveDoc,
}: {
  inputModule: PipelineModule
  outModel?: string
  docs: DocRef[]
  issue?: { message: string }
  onOpenPicker: () => void
  onOpenDoc: (docId: DocId) => void
  onRemoveDoc?: (docId: DocId) => void
}) {
  const min = inputMinCountForModule(inputModule)
  const multi = isMultiDocInputModule(inputModule)
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
              <button
                type="button"
                onClick={() => onOpenDoc(doc.id)}
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5 font-mono text-[10px] transition-colors hover:border-primary/40 hover:bg-primary/5"
                title="Preview selected document"
              >
                <Link2 className="h-3 w-3 shrink-0 text-primary" />
                <FileText className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{doc.name}</span>
              </button>
              {multi && onRemoveDoc && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => onRemoveDoc(doc.id)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
          {multi && (
            <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={onOpenPicker}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Add document
            </Button>
          )}
          {!multi && (
            <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={onOpenPicker}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Change
            </Button>
          )}
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={onOpenPicker}>
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Choose from store
        </Button>
      )}
      {issue && (
        <p className="mt-2 font-mono text-[10px] text-destructive">{issue.message}</p>
      )}
    </div>
  )
}
