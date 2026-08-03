"use client"

import {
  catalogLabel,
  formatRoutedModel,
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

export function normalizeModelRef(id: string | undefined, defaultProviderId = "openrouter"): string {
  if (!id) return formatRoutedModel(defaultProviderId, "deepseek-v4")
  const parsed = parseRoutedModel(id)
  return formatRoutedModel(parsed.providerId, parsed.modelId)
}

export { wireModelId }
