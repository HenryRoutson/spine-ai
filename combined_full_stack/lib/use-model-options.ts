"use client"

import {
  catalogLabel,
  DEFAULT_MODEL,
  formatRoutedModel,
  OPENROUTER_PROVIDER_ID,
  parseRoutedModel,
  wireModelId,
} from "@/lib/types"
import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"

export function useModelOptions() {
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  const source = builder ?? consumer
  if (!source) throw new Error("useModelOptions requires StoreProvider")
  return source.modelOptions
}

export function modelLabel(id?: string): string {
  if (!id) return "—"
  const parsed = parseRoutedModel(id)
  const model = catalogLabel(parsed.modelId)
  return `${parsed.providerId}:${model}`
}

export function normalizeModelRef(
  id: string | undefined,
  defaultProviderId = OPENROUTER_PROVIDER_ID,
): string {
  if (!id) {
    const fallback = parseRoutedModel(DEFAULT_MODEL)
    return formatRoutedModel(defaultProviderId, fallback.modelId)
  }
  const parsed = parseRoutedModel(id)
  return formatRoutedModel(parsed.providerId, parsed.modelId)
}

export { wireModelId }
