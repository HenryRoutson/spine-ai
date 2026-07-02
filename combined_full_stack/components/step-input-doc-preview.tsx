"use client"

import { IoPager } from "@/components/logging/io-pager"
import { InlineDocPreview } from "@/components/inline-doc-preview"
import { PromptText } from "@/components/highlight"
import { stepInputDocIds, resolveDocRef } from "@/lib/step-doc"
import type { DocId, DocRef, InputPreviewItem, RunStep, StructureModel } from "@/lib/types"

type StepInputDocPreviewProps = {
  step: RunStep
  docs: DocRef[]
  models?: StructureModel[]
  className?: string
}

function pagerItems(step: RunStep, docIds: DocId[], docs: DocRef[]): InputPreviewItem[] {
  if (step.inputPreviewItems?.length === docIds.length) return step.inputPreviewItems
  return docIds.map((id, i) => ({
    label: docs.find((d) => d.id === id)?.name ?? id,
    text: id,
  }))
}

// AI : shared input-step file preview — logging tab + inference step trace.
export function StepInputDocPreview({ step, docs, models, className }: StepInputDocPreviewProps) {
  const docIds = stepInputDocIds(step)
  if (!docIds.length) {
    return step.inputPreview ? <PromptText text={step.inputPreview} /> : null
  }

  if (docIds.length > 1) {
    return (
      <IoPager
        items={pagerItems(step, docIds, docs)}
        renderItem={(_, index) => {
          const docId = docIds[index]!
          return (
            <InlineDocPreview
              docId={docId}
              doc={resolveDocRef(docs, docId)}
              models={models}
              className={className}
            />
          )
        }}
      />
    )
  }

  const docId = docIds[0]!
  return (
    <InlineDocPreview
      docId={docId}
      doc={resolveDocRef(docs, docId)}
      models={models}
      className={className}
    />
  )
}

type AssignedInputDocPreviewProps = {
  docs: DocRef[]
  models?: StructureModel[]
  className?: string
}

// AI : inference trace before persisted run steps — uses slot-assigned docs.
export function AssignedInputDocPreview({ docs, models, className }: AssignedInputDocPreviewProps) {
  if (!docs.length) return null
  if (docs.length > 1) {
    return (
      <IoPager
        items={docs.map((d, i) => ({
          label: `${d.name} (${i + 1}/${docs.length})`,
          text: d.id,
        }))}
        renderItem={(_, index) => {
          const doc = docs[index]!
          return (
            <InlineDocPreview docId={doc.id} doc={doc} models={models} className={className} />
          )
        }}
      />
    )
  }
  const doc = docs[0]!
  return <InlineDocPreview docId={doc.id} doc={doc} models={models} className={className} />
}
