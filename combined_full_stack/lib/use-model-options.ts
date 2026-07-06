"use client"

import { catalogLabel } from "@/lib/types"
import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"

export function useModelOptions() {
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  const source = builder ?? consumer
  if (!source) throw new Error("useModelOptions requires StoreProvider")
  return source.modelOptions
}

export function modelLabel(id?: string): string {
  return catalogLabel(id) ?? id ?? "—"
}
