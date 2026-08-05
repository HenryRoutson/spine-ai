"use client"

import { useState } from "react"
import { IoSection } from "@/components/logging/io-section"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { AssignedInputDocPreview, StepInputDocPreview } from "@/components/step-input-doc-preview"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"
import { stepDocId, stepDocLinkLabels, stepInputDocIds } from "@/lib/step-doc"
import { cn } from "@/lib/utils"
import type { DocId, DocRef, RunStep, StructureModel } from "@/lib/types"

// AI : standard "loaded Text → sha_…" block — shared by logging + inference step trace.
export function StepLoadedDocSection({
  step,
  assignedDocs = [],
  docs,
  models,
  className,
}: {
  step?: RunStep
  assignedDocs?: DocRef[]
  docs: DocRef[]
  models?: StructureModel[]
  className?: string
}) {
  const [popup, setPopup] = useState<PopupPayload | null>(null)
  const docIds = step ? stepInputDocIds(step) : assignedDocs.map((d) => d.id)
  if (!docIds.length) return null

  const primaryDocId = (step ? stepDocId(step) : assignedDocs[0]?.id) as DocId | undefined
  const primaryDocRef = primaryDocId ? docs.find((d) => d.id === primaryDocId) : assignedDocs[0]
  const docLinks = stepDocLinkLabels(primaryDocRef)
  const summary =
    step?.outputPreview?.trim() ||
    (assignedDocs.length === 1
      ? `loaded → ${assignedDocs[0]!.id}`
      : `${assignedDocs.length} documents loaded`)
  const expandTitle =
    step != null
      ? `Input · ${step.label}`
      : assignedDocs.length === 1
        ? `Input · ${assignedDocs[0]!.name}`
        : `Input · ${assignedDocs.length} documents`

  return (
    <>
      <IoSection
        title="Input"
        qualifier="input"
        summary={compactPreview(summary, PREVIEW_STEP_IO_CHARS)}
        docLink={
          primaryDocId
            ? { docId: primaryDocId, ...docLinks.input }
            : undefined
        }
        bodyClickable={false}
        className={cn("mt-2 !pl-0", className)}
        onExpand={() =>
          setPopup({
            title: expandTitle,
            docPreviews: docIds.map((id) => ({
              docId: id,
              doc: docs.find((d) => d.id === id),
              label: docs.find((d) => d.id === id)?.name ?? id,
            })),
            models,
          })
        }
      >
        {step ? (
          <StepInputDocPreview step={step} docs={docs} models={models} />
        ) : (
          <AssignedInputDocPreview docs={assignedDocs} models={models} />
        )}
      </IoSection>
      {popup && <PopupModal payload={popup} onClose={() => setPopup(null)} />}
    </>
  )
}
