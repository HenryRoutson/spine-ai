"use client"

import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"

export function useWorkspaceModel() {
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  const source = builder ?? consumer
  if (!source) throw new Error("useWorkspaceModel requires StoreProvider")
  return { model: source.model, setModel: source.setModel }
}
