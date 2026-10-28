"use client"

import { IoSection } from "@/components/logging/io-section"
import { DiagnosisRunLink } from "@/components/diagnosis-agents/diagnosis-run-link"
import { diagnosisRunLinkId } from "@/lib/diagnosis-link"
import { compactPreview, PREVIEW_STEP_IO_CHARS } from "@/lib/text-preview"

export function StepValidationErrorsSection({
  errorPreview,
  runId,
  className,
  onExpand,
}: {
  errorPreview: string
  runId?: string
  className?: string
  onExpand?: () => void
}) {
  return (
    <IoSection
      title="Validation errors"
      qualifier="error"
      className={className}
      anchorId={runId ? diagnosisRunLinkId(runId) : undefined}
      headerExtra={runId ? <DiagnosisRunLink runId={runId} /> : undefined}
      summary={compactPreview(errorPreview, PREVIEW_STEP_IO_CHARS)}
      onExpand={onExpand}
    >
      <p className="whitespace-pre-wrap text-destructive">{errorPreview}</p>
    </IoSection>
  )
}
