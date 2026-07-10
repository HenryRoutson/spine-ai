"use client"

import { useEffect, useRef, useState } from "react"

// AI : flash a lock banner when the user tries to edit a locked struct/type.
export function useLockedInteractFlash(message: string | null, resetKey: string) {
  const [flash, setFlash] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bannerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    setFlash(false)
    if (timer.current) clearTimeout(timer.current)
  }, [resetKey])

  function notifyLocked() {
    if (!message) return
    setFlash(true)
    bannerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setFlash(false), 2800)
  }

  return { flash, bannerRef, notifyLocked }
}
