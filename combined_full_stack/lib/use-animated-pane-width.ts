"use client"

// AI : mount + width tween for push-in side panels (open 0→target, close target→0).

import { useCallback, useEffect, useState } from "react"

type pixel_width = number

export const PANE_ANIMATION_MS = 250 as const

export function useAnimatedPaneWidth(open: boolean, targetWidth: pixel_width) {
  const [mounted, setMounted] = useState(open)
  const [width, setWidth] = useState<pixel_width>(open ? targetWidth : 0)
  const [animating, setAnimating] = useState(false)

  const setPaneWidth = useCallback((nextWidth: pixel_width) => {
    setAnimating(false)
    setWidth(nextWidth)
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)
      setAnimating(true)
      setWidth(0)
      const nextWidth = targetWidth
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setWidth(nextWidth))
      })
      return () => cancelAnimationFrame(frame)
    }
    setAnimating(true)
    setWidth(0)
    // AI : only re-run on open/close — width sync while open lives in the effect below.
  }, [open])

  useEffect(() => {
    if (!open || animating) return
    setWidth(targetWidth)
  }, [targetWidth, open, animating])

  // AI : transitionend can be skipped if the browser coalesces frames — don't block resize.
  useEffect(() => {
    if (!animating) return
    const id = window.setTimeout(() => setAnimating(false), PANE_ANIMATION_MS + 50)
    return () => window.clearTimeout(id)
  }, [animating])

  const onPaneTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "width") return
      setAnimating(false)
      if (!open) setMounted(false)
    },
    [open],
  )

  return { mounted, width, setPaneWidth, onPaneTransitionEnd, durationMs: PANE_ANIMATION_MS, animating }
}
