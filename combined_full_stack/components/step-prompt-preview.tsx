"use client"

import { useMemo } from "react"
import { IoPager } from "@/components/logging/io-pager"
import { PromptCacheStats } from "@/components/prompt-cache-stats"
import { PromptCacheText } from "@/components/prompt-cache-text"
import { StepResponseJsonText } from "@/components/step-response-json-text"
import { formatRunStepPromptCacheSnippet } from "@/lib/assistant-observe"
import {
  analyzePromptCacheRegions,
  resolvePromptPreviewItems,
} from "@/lib/prompt-cache-regions"
import { resolveStepResponsePreviewItems } from "@/lib/step-response-preview"
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import type { DocId, InputPreviewItem, ModuleId, RunStep, StructureModel } from "@/lib/types"

export type StepPromptPreviewProps = {
  inputPreview?: string
  inputPreviewItems?: InputPreviewItem[]
  responseItems?: InputPreviewItem[]
  sourceDocId?: DocId
  // AI : Select UI pin for agent — runtime cache stats from a run step.
  runStep?: RunStep
  runId?: string
  moduleId?: ModuleId
  stepLabel?: string
  models?: StructureModel[]
}

export function StepPromptPreview({
  inputPreview,
  inputPreviewItems,
  responseItems,
  sourceDocId,
  runStep,
  runId,
  moduleId,
  stepLabel,
  models,
}: StepPromptPreviewProps) {
  const items = useMemo(
    () => resolvePromptPreviewItems(inputPreview, inputPreviewItems),
    [inputPreview, inputPreviewItems],
  )
  const responses = useMemo(
    () =>
      responseItems?.length
        ? responseItems
        : runStep
          ? resolveStepResponsePreviewItems(runStep)
          : [],
    [responseItems, runStep],
  )
  const regions = useMemo(
    () => analyzePromptCacheRegions(items.map((item) => item.text)),
    [items],
  )

  if (!items.length) return null

  const prefixLen = regions?.prefixLen
  const pinModuleId = moduleId ?? runStep?.moduleId
  const responseTitle = `Response · ${stepLabel ?? runStep?.label ?? "step"}`
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

  function renderPair(item: InputPreviewItem, index: number) {
    const response = responses[index]
    return (
      <>
        <PromptCacheText text={item.text} prefixLen={prefixLen} sourceDocId={sourceDocId} />
        {response?.text.trim() ? (
          <StepResponseJsonText
            json={response.text}
            title={`${responseTitle} · ${response.label}`}
            models={models}
          />
        ) : null}
      </>
    )
  }

  if (items.length <= 1) {
    return <div {...pinProps}>{renderPair(items[0]!, 0)}</div>
  }

  return (
    <div className="space-y-2" {...pinProps}>
      {regions ? <PromptCacheStats regions={regions} /> : null}
      <IoPager items={items} renderItem={renderPair} />
    </div>
  )
}
