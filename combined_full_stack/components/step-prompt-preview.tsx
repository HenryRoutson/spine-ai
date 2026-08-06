"use client"

import { useMemo } from "react"
import { IoPager } from "@/components/logging/io-pager"
import { PromptCacheStats } from "@/components/prompt-cache-stats"
import { PromptCacheText } from "@/components/prompt-cache-text"
import {
  analyzePromptCacheRegions,
  resolvePromptPreviewItems,
} from "@/lib/prompt-cache-regions"
import type { DocId, InputPreviewItem } from "@/lib/types"

export type StepPromptPreviewProps = {
  inputPreview?: string
  inputPreviewItems?: InputPreviewItem[]
  sourceDocId?: DocId
}

// AI : shared LLM prompt viewer — cache-region stats + pager for example-select / llm-batch.
export function StepPromptPreview({
  inputPreview,
  inputPreviewItems,
  sourceDocId,
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

  if (items.length <= 1) {
    return (
      <PromptCacheText text={items[0]!.text} prefixLen={prefixLen} sourceDocId={sourceDocId} />
    )
  }

  return (
    <>
      {regions && <PromptCacheStats regions={regions} />}
      <IoPager
        items={items}
        renderItem={(item) => (
          <PromptCacheText text={item.text} prefixLen={prefixLen} sourceDocId={sourceDocId} />
        )}
      />
    </>
  )
}
