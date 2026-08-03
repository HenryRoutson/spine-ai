"use client"

// AI : drag-to-resize horizontal split — leading pane width in px, trailing fills the rest.

import { useCallback, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type pixel_width = number

export type ResizableSplitProps = {
  leading: ReactNode
  trailing: ReactNode
  leadingWidth: pixel_width
  onLeadingWidthChange: (width: pixel_width) => void
  onLeadingWidthCommit?: (width: pixel_width) => void
  minLeading?: pixel_width
  maxLeading?: pixel_width
  // AI : "trailing" fixes the right pane width (e.g. assistant dock); default is left sidebar.
  fixedSide?: "leading" | "trailing"
  className?: string
}

function clearDragChrome(): void {
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
}

export function ResizableSplit({
  leading,
  trailing,
  leadingWidth,
  onLeadingWidthChange,
  onLeadingWidthCommit,
  minLeading = 180,
  maxLeading = 720,
  fixedSide = "leading",
  className,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const latestWidth = useRef(leadingWidth)

  const clampWidth = useCallback(
    (raw: pixel_width): pixel_width => Math.min(maxLeading, Math.max(minLeading, raw)),
    [maxLeading, minLeading],
  )

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const raw =
        fixedSide === "trailing" ? rect.right - e.clientX : e.clientX - rect.left
      const next = clampWidth(raw)
      latestWidth.current = next
      onLeadingWidthChange(next)
    },
    [clampWidth, fixedSide, onLeadingWidthChange],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      dragging.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
      clearDragChrome()
      onLeadingWidthCommit?.(latestWidth.current)
    },
    [onLeadingWidthCommit],
  )

  const separator = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={leadingWidth}
      aria-valuemin={minLeading}
      aria-valuemax={maxLeading}
      tabIndex={0}
      title="Drag to resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="group relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none border-x border-border/60 bg-border/20 hover:bg-primary/25 active:bg-primary/40"
    >
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  )

  const fixedPane = (
    <div className="flex min-h-0 shrink-0 flex-col overflow-hidden" style={{ width: leadingWidth }}>
      {fixedSide === "trailing" ? trailing : leading}
    </div>
  )

  const flexPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {fixedSide === "trailing" ? leading : trailing}
    </div>
  )

  return (
    <div ref={containerRef} className={cn("flex min-h-0 min-w-0", className)}>
      {fixedSide === "trailing" ? (
        <>
          {flexPane}
          {separator}
          {fixedPane}
        </>
      ) : (
        <>
          {fixedPane}
          {separator}
          {flexPane}
        </>
      )}
    </div>
  )
}
