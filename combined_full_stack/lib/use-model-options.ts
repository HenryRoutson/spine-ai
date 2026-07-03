"use client"

import { catalogLabel } from "@/lib/types"
import { useStore } from "@/lib/store"

export function useModelOptions() {
  return useStore().modelOptions
}

export function modelLabel(id?: string): string {
  return catalogLabel(id) ?? id ?? "—"
}
