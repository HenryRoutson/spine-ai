"use client"

import { useState } from "react"
import { IoSection } from "@/components/logging/io-section"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { StepPromptPreview } from "@/components/step-prompt-preview"
import { stepIoLabels } from "@/lib/module-kinds"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"
import { stepHasPromptPreview } from "@/lib/prompt-cache-regions"
import { stepSourceDocId } from "@/lib/step-doc"
import { cn } from "@/lib/utils"
import type { DocId, InputPreviewItem, RunStep, RunStepKind } from "@/lib/types"

type StepPromptSectionProps = {
  step?: RunStep
  kind?: RunStepKind
  label: string
  inputPreview?: string
  inputPreviewItems?: InputPreviewItem[]
  sourceDocId?: DocId
  className?: string
}

// AI : standard LLM prompt block — logging tab + inference step trace.
export function StepPromptSection({
  step,
  kind,
  label,
  inputPreview,
  inputPreviewItems,
  sourceDocId: sourceDocIdProp,
  className,
}: StepPromptSectionProps) {
  const [popup, setPopup] = useState<PopupPayload | null>(null)

  const resolvedKind = step?.kind ?? kind
  const resolvedPreview = step?.inputPreview ?? inputPreview
  const resolvedItems = step?.inputPreviewItems ?? inputPreviewItems
  const sourceDocId = sourceDocIdProp ?? (step ? stepSourceDocId(step) : undefined)

  if (
    !resolvedKind ||
    !stepHasPromptPreview({
      kind: resolvedKind,
      inputPreview: resolvedPreview,
      inputPreviewItems: resolvedItems,
    })
  ) {
    return null
  }

  const { inTitle } = stepIoLabels(resolvedKind)
  const summary = compactPreview(resolvedPreview ?? "", PREVIEW_STEP_IO_CHARS)

  return (
    <>
      <IoSection
        title={inTitle}
        qualifier="input"
        summary={summary}
        bodyClickable={false}
        className={cn("mt-2 !pl-0", className)}
        onExpand={() =>
          setPopup({
            title: `${inTitle} (input) · ${label}`,
            promptItems: resolvedItems,
            inputPreview: resolvedPreview,
            sourceDocId,
          })
        }
      >
        <StepPromptPreview
          inputPreview={resolvedPreview}
          inputPreviewItems={resolvedItems}
          sourceDocId={sourceDocId}
        />
      </IoSection>
      {popup && <PopupModal payload={popup} onClose={() => setPopup(null)} />}
    </>
  )
}
