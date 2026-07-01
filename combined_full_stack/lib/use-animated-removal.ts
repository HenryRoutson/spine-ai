"use client"

import { useCallback, useState } from "react"

export const REMOVAL_EXIT_MS = 300

type GhostSlot<T extends { id: string }> = {
  id: string
  item: T
  index: number
}

export function useAnimatedRemoval<T extends { id: string }>() {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set())
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set())
  const [ghostSlots, setGhostSlots] = useState<GhostSlot<T>[]>([])

  const isDeleting = useCallback((id: string) => deletingIds.has(id), [deletingIds])
  const isExiting = useCallback((id: string) => exitingIds.has(id), [exitingIds])

  const runDelete = useCallback(
    async (item: T, items: T[], deleteFn: () => Promise<void>) => {
      if (deletingIds.has(item.id) || exitingIds.has(item.id)) return
      const index = items.findIndex((row) => row.id === item.id)
      setDeletingIds((prev) => new Set(prev).add(item.id))
      try {
        await deleteFn()
        setDeletingIds((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
        setGhostSlots((prev) => [...prev, { id: item.id, item, index: index < 0 ? prev.length : index }])
        setExitingIds((prev) => new Set(prev).add(item.id))
        window.setTimeout(() => {
          setExitingIds((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
          setGhostSlots((prev) => prev.filter((slot) => slot.id !== item.id))
        }, REMOVAL_EXIT_MS)
      } catch {
        setDeletingIds((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }
    },
    [deletingIds, exitingIds],
  )

  const mergeWithGhosts = useCallback(
    (items: T[]): T[] => {
      if (ghostSlots.length === 0) return items
      const liveIds = new Set(items.map((row) => row.id))
      const activeGhosts = ghostSlots.filter((slot) => !liveIds.has(slot.id))
      if (activeGhosts.length === 0) return items
      const result = [...items]
      const sorted = [...activeGhosts].sort((a, b) => b.index - a.index)
      for (const { item, index } of sorted) {
        result.splice(Math.min(index, result.length), 0, item)
      }
      return result
    },
    [ghostSlots],
  )

  return { isDeleting, isExiting, runDelete, mergeWithGhosts }
}
