"use client"
// AI : portal so expand isn't clipped by Share studio overflow-hidden panes.

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Maximize2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HTML_POPUP_CHROME, HTML_POPUP_OVERLAY_ATTR } from "@/lib/html-popup"
import { cn } from "@/lib/utils"

export function HtmlPreviewFrame({
  label = "Preview",
  children,
  className,
  bodyClassName,
}: {
  label?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const close = useCallback(() => setExpanded(false), [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [expanded, close])

  useEffect(() => {
    if (!expanded) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [expanded])

  return (
    <>
      <div className={cn("overflow-hidden rounded-md border border-border", className)}>
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1">
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(true)}
            title="Expand preview"
            aria-label="Expand preview"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
        <div className={cn("max-h-72 overflow-auto bg-background", bodyClassName)}>
          {expanded ? (
            <p className="p-4 text-[10px] text-muted-foreground">Preview is expanded</p>
          ) : (
            children
          )}
        </div>
      </div>

      {expanded && mounted
        ? createPortal(
            <div className={HTML_POPUP_CHROME.overlay} {...{ [HTML_POPUP_OVERLAY_ATTR]: "" }}>
              <button
                type="button"
                aria-label="Close preview"
                className={HTML_POPUP_CHROME.backdrop}
                onClick={close}
              />
              <div className={HTML_POPUP_CHROME.panel}>
                <div className={HTML_POPUP_CHROME.header}>
                  <span className={HTML_POPUP_CHROME.title}>{label} · Esc to close</span>
                  <button
                    type="button"
                    className={HTML_POPUP_CHROME.close}
                    onClick={close}
                    aria-label="Close preview"
                    title="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className={cn(HTML_POPUP_CHROME.body, "overflow-auto bg-background")}>{children}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
