"use client"
// AI : portal so expand isn't clipped by Share studio overflow-hidden panes.

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Maximize2, Monitor, Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HTML_POPUP_CHROME, HTML_POPUP_OVERLAY_ATTR } from "@/lib/html-popup"
import { spineActionProps } from "@/lib/core/parity"
import { isHsPreviewMessage, type HsPreviewInlinePayload, type HsPreviewSelectPayload } from "@/lib/hosted-site-select"
import { cn } from "@/lib/utils"

type preview_viewport = "desktop" | "mobile"

const MOBILE_FRAME_WIDTH_PX = 390
const MOBILE_FRAME_HEIGHT_PX = 720

function PreviewViewport({ viewport, children }: { viewport: preview_viewport; children: ReactNode }) {
  if (viewport === "desktop") return children
  return (
    <div className="flex justify-center bg-muted/40 p-3">
      <div
        className="overflow-hidden rounded-[1.65rem] border-[7px] border-neutral-800 bg-background shadow-xl"
        style={{ width: MOBILE_FRAME_WIDTH_PX, height: MOBILE_FRAME_HEIGHT_PX }}
      >
        <div className="h-full overflow-auto">{children}</div>
      </div>
    </div>
  )
}

export function HtmlPreviewFrame({
  label = "Preview",
  children,
  className,
  bodyClassName,
  extraToolbar,
  onSelect,
  onInlineText,
}: {
  label?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
  extraToolbar?: ReactNode
  onSelect?: (payload: HsPreviewSelectPayload) => void
  onInlineText?: (payload: HsPreviewInlinePayload) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [viewport, setViewport] = useState<preview_viewport>("desktop")
  const close = useCallback(() => setExpanded(false), [])
  const nextViewport: preview_viewport = viewport === "desktop" ? "mobile" : "desktop"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!onSelect && !onInlineText) return
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (!isHsPreviewMessage(e.data)) return
      if (e.data.kind === "select") onSelect?.(e.data)
      if (e.data.kind === "inline") onInlineText?.(e.data)
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [onSelect, onInlineText])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [expanded, close])

  const framed = <PreviewViewport viewport={viewport}>{children}</PreviewViewport>
  const viewportButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
      onClick={() => setViewport(nextViewport)}
      title={`Switch to ${nextViewport} preview`}
      aria-label={`Switch to ${nextViewport} preview`}
      {...spineActionProps("share.site-preview-viewport")}
    >
      {viewport === "desktop" ? <Monitor className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
      {viewport === "desktop" ? "Desktop" : "Mobile"}
    </Button>
  )

  return (
    <>
      <div className={cn("overflow-hidden rounded-md border border-border", className)}>
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-2 py-1">
          <p className="min-w-0 truncate text-[10px] text-muted-foreground">
            {label} · {viewport === "desktop" ? "Desktop" : "Mobile"}
          </p>
          <div className="flex items-center gap-0.5">
            {onSelect ? <span className="sr-only" {...spineActionProps("share.site-preview-select")} /> : null}
            {onInlineText ? <span className="sr-only" {...spineActionProps("share.site-preview-inline")} /> : null}
            {extraToolbar}
            {viewportButton}
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
        </div>
        <div className={cn("max-h-72 overflow-auto bg-background", bodyClassName)}>
          {expanded ? <p className="p-4 text-[10px] text-muted-foreground">Preview is expanded</p> : framed}
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
                  <span className={HTML_POPUP_CHROME.title}>
                    {label} · {viewport === "desktop" ? "Desktop" : "Mobile"} · Esc to close
                  </span>
                  <div className="flex items-center gap-1">
                    {extraToolbar}
                    {viewportButton}
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
                </div>
                <div className={cn(HTML_POPUP_CHROME.body, "overflow-auto bg-background")}>{framed}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
