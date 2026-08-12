"use client"

import { useMemo } from "react"
import { IoPager } from "@/components/logging/io-pager"
import { PromptCacheStats } from "@/components/prompt-cache-stats"
import { PromptCacheText } from "@/components/prompt-cache-text"
import { formatRunStepPromptCacheSnippet } from "@/lib/assistant-observe"
import {
  analyzePromptCacheRegions,
  resolvePromptPreviewItems,
} from "@/lib/prompt-cache-regions"
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import type { DocId, InputPreviewItem, ModuleId, RunStep } from "@/lib/types"

export type StepPromptPreviewProps = {
  inputPreview?: string
  inputPreviewItems?: InputPreviewItem[]
  sourceDocId?: DocId
  // AI : Select UI pin for agent — runtime cache stats from a run step.
  runStep?: RunStep
  runId?: string
  moduleId?: ModuleId
  stepLabel?: string
}

export function StepPromptPreview({
  inputPreview,
  inputPreviewItems,
  sourceDocId,
  runStep,
  runId,
  moduleId,
  stepLabel,
}: StepPromptPreviewProps) {
  const items = useMemo(
    () => resolvePromptPreviewItems(inputPreview, inputPreviewItems),
    [inputPreview, inputPreviewItems],
  )
  const regions = useMemo(
    () => analyzePromptCacheRegions(items.map((item) => item.text)),
    [items],
  )

  if (!items.length) return null

  const prefixLen = regions?.prefixLen
  const pinModuleId = moduleId ?? runStep?.moduleId
  const pinProps =
    runId && pinModuleId
      ? uiContextTargetProps({
          kind: "prompt_cache",
          id: `cache:run:${runId}:step:${pinModuleId}`,
          label: `Cache · ${stepLabel ?? runStep?.label ?? pinModuleId}`,
          moduleId: pinModuleId,
          fieldPath: `run:${runId}`,
          snippet: runStep
            ? formatRunStepPromptCacheSnippet(runStep)
            : items[0]?.text.slice(0, 400),
        })
      : {}

  if (items.length <= 1) {
    return (
      <div {...pinProps}>
        <PromptCacheText text={items[0]!.text} prefixLen={prefixLen} sourceDocId={sourceDocId} />
      </div>
    )
  }

  return (
    <div className="space-y-2" {...pinProps}>
      {regions ? <PromptCacheStats regions={regions} /> : null}
      <IoPager
        items={items}
        renderItem={(item) => (
          <PromptCacheText text={item.text} prefixLen={prefixLen} sourceDocId={sourceDocId} />
        )}
      />
    </div>
  )
}
