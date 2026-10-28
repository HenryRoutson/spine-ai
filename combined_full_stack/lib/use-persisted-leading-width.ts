"use client"

// AI : local drag state synced with layout-split-settings persisted width.

import { useEffect, useState } from "react"
import { useLayoutSplitWidth } from "@/lib/layout-split-settings"

type pixel_width = number

type SplitBinding = {
  read: () => pixel_width
  write: (width: pixel_width) => void
}

export function usePersistedLeadingWidth(split: SplitBinding): {
  width: pixel_width
  setWidth: (width: pixel_width) => void
  commitWidth: (width: pixel_width) => void
} {
  const saved = useLayoutSplitWidth(split.read)
  const [width, setWidth] = useState(split.read)
  useEffect(() => setWidth(saved), [saved])
  return { width, setWidth, commitWidth: split.write }
}
