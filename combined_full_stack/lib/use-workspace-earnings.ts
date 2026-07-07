"use client"

import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"

export function useWorkspaceEarnings() {
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  const source = builder ?? consumer
  if (!source) throw new Error("useWorkspaceEarnings requires StoreProvider")
  return {
    earningsAccount: source.earningsAccount,
    refreshEarnings: source.refreshEarnings,
  }
}
