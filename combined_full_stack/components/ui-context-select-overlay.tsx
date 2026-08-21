"use client"

// AI : select-mode overlay — portal highlight + click to pin UiContextRef (Esc exits).
// AI : while active, blocks app interactions outside ignore regions so inputs/buttons don't steal pins.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  findUiContextTargetAtPoint,
  readUiContextFromElement,
  sameOriginIframes,
  topLevelPointFromEvent,
  viewportRectOf,
  UI_CONTEXT_ATTR,
} from "@/lib/ui-context-dom"
import type { UiContextRef } from "@/lib/ui-context-types"
import { useProjectAssistant } from "@/lib/project-assistant-context"

const HOVER_CLASS = "ui-context-hover-target"
const BODY_SELECTING_CLASS = "ui-context-selecting"

type HoverBox = {
  top: number
  left: number
  width: number
  height: number
  label: string
}

function eventInIgnoreZone(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(`[${UI_CONTEXT_ATTR.ignore}]`))
}

export function UiContextSelectOverlay() {
  const { selectMode, setSelectMode, pinUiContext, open, setOpen } = useProjectAssistant()
  const [hover, setHover] = useState<HoverBox | null>(null)
  const [mounted, setMounted] = useState(false)
  const lastTargetRef = useRef<Element | null>(null)
  // AI : keep open/pin stable in listeners — remounting on `open` flickered hover after pin.
  const openRef = useRef(open)
  const pinRef = useRef(pinUiContext)
  openRef.current = open
  pinRef.current = pinUiContext

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!selectMode) {
      setHover(null)
      lastTargetRef.current?.classList.remove(HOVER_CLASS)
      lastTargetRef.current = null
      document.body.classList.remove(BODY_SELECTING_CLASS)
      return
    }

    const prevCursor = document.body.style.cursor
    document.body.style.cursor = "crosshair"
    document.body.classList.add(BODY_SELECTING_CLASS)
    // AI : drop focus so Enter/Space can't activate a previously focused control.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    function clearHoverTarget() {
      lastTargetRef.current?.classList.remove(HOVER_CLASS)
      lastTargetRef.current = null
    }

    function updateHover(x: number, y: number) {
      if (eventInIgnoreZone(document.elementFromPoint(x, y))) {
        clearHoverTarget()
        setHover(null)
        return
      }
      const target = findUiContextTargetAtPoint(x, y)
      if (!target) {
        clearHoverTarget()
        setHover(null)
        return
      }
      if (lastTargetRef.current !== target) {
        clearHoverTarget()
        target.classList.add(HOVER_CLASS)
        lastTargetRef.current = target
      }
      const ref = readUiContextFromElement(target)
      const rect = viewportRectOf(target)
      setHover({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        label: ref?.label ?? "UI",
      })
    }

    function onPointerMove(e: PointerEvent) {
      const p = topLevelPointFromEvent(e)
      updateHover(p.x, p.y)
    }

    // AI : swallow interactions outside the agent dock so editors/buttons don't fire during select.
    function blockAppInteraction(e: Event) {
      if (eventInIgnoreZone(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      if (typeof (e as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation === "function") {
        e.stopImmediatePropagation()
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      if (eventInIgnoreZone(e.target)) return
      blockAppInteraction(e)
      const p = topLevelPointFromEvent(e)
      const target = findUiContextTargetAtPoint(p.x, p.y)
      if (!target) return
      const ref = readUiContextFromElement(target)
      if (!ref) return
      pinRef.current(ref)
      if (!openRef.current) setOpen(true)
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        setSelectMode(false)
        return
      }
      // AI : allow typing in the agent composer (ignore zone); block shortcuts elsewhere.
      if (eventInIgnoreZone(e.target)) return
      if (e.key === "Tab" || e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      e.stopPropagation()
    }

    function onScroll() {
      if (!lastTargetRef.current) return
      const rect = viewportRectOf(lastTargetRef.current)
      setHover((prev) =>
        prev
          ? {
              ...prev,
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }
          : prev,
      )
    }

    const ac = new AbortController()
    const cap = { capture: true, signal: ac.signal } as const
    const boundDocs = new WeakSet<Document>()
    const iframeCursors: HTMLElement[] = []

    const boundIframes = new WeakSet<HTMLIFrameElement>()

    function bindDoc(doc: Document) {
      if (boundDocs.has(doc)) return
      boundDocs.add(doc)
      doc.addEventListener("pointermove", onPointerMove, cap)
      doc.addEventListener("pointerdown", onPointerDown, cap)
      doc.addEventListener("pointerup", blockAppInteraction, cap)
      doc.addEventListener("mousedown", blockAppInteraction, cap)
      doc.addEventListener("mouseup", blockAppInteraction, cap)
      doc.addEventListener("click", blockAppInteraction, cap)
      doc.addEventListener("dblclick", blockAppInteraction, cap)
      doc.addEventListener("contextmenu", blockAppInteraction, cap)
      doc.addEventListener("dragstart", blockAppInteraction, cap)
      doc.addEventListener("keydown", onKeyDown, cap)
      doc.addEventListener("scroll", onScroll, cap)
      if (doc !== document) {
        const style = doc.createElement("style")
        style.textContent = `.${HOVER_CLASS}{outline:2px solid rgb(56 189 248)!important;outline-offset:2px!important;}`
        doc.head?.appendChild(style)
        if (doc.body) {
          doc.body.style.cursor = "crosshair"
          doc.body.style.userSelect = "none"
          iframeCursors.push(doc.body)
        }
      }
    }

    function bindIframes() {
      for (const iframe of sameOriginIframes()) {
        if (!boundIframes.has(iframe)) {
          boundIframes.add(iframe)
          iframe.addEventListener(
            "load",
            () => {
              const doc = iframe.contentDocument
              if (doc) bindDoc(doc)
            },
            cap,
          )
        }
        const doc = iframe.contentDocument
        if (doc && doc.body) bindDoc(doc)
      }
    }

    bindDoc(document)
    bindIframes()
    const mo = new MutationObserver(bindIframes)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      ac.abort()
      mo.disconnect()
      document.body.style.cursor = prevCursor
      document.body.classList.remove(BODY_SELECTING_CLASS)
      for (const body of iframeCursors) {
        body.style.cursor = ""
        body.style.userSelect = ""
      }
      clearHoverTarget()
    }
  }, [selectMode, setSelectMode, setOpen])

  if (!selectMode || !mounted) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[9999]"
      aria-hidden
      {...{ [UI_CONTEXT_ATTR.ignore]: "" }}
    >
      <style>{`
        .${HOVER_CLASS} {
          outline: 2px solid rgb(56 189 248) !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 4px rgb(56 189 248 / 0.3) !important;
          position: relative;
          z-index: 1;
        }
        body.${BODY_SELECTING_CLASS} {
          user-select: none;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-3">
        <p className="rounded-md border border-sky-400/50 bg-background px-3 py-1.5 font-mono text-[11px] text-foreground shadow-lg">
          Select mode · pick a cell, file, or label · Esc exits
        </p>
      </div>
      {hover && (
        <>
          <div
            className="pointer-events-none absolute rounded-md border-2 border-sky-400 bg-sky-400/15"
            style={{
              top: hover.top - 2,
              left: hover.left - 2,
              width: hover.width + 4,
              height: hover.height + 4,
            }}
          />
          <div
            className="pointer-events-none absolute z-[10000] max-w-md line-clamp-2 rounded bg-sky-400 px-2 py-1 font-mono text-[11px] font-medium text-sky-950 shadow-lg"
            style={{
              top: Math.max(8, hover.top - 44),
              left: hover.left,
            }}
          >
            {hover.label}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

export type { UiContextRef }
