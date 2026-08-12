"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  uiContextRefFromChatQuote,
  type UiContextRef,
} from "@/lib/ui-context-types"

// AI : highlight agent chat → floating Quote → pin as chat_quote context (no copy-paste).

type ToolbarPos = { top: number; left: number }

type ChatQuoteSelectionProps = {
  enabled: boolean
  containerRef: RefObject<HTMLDivElement | null>
  onQuote: (ref: UiContextRef) => void
  children: ReactNode
}

function selectionInside(container: HTMLElement, sel: Selection): boolean {
  if (sel.rangeCount === 0 || sel.isCollapsed) return false
  const range = sel.getRangeAt(0)
  const node = range.commonAncestorContainer
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  if (!el || !container.contains(el)) return false
  // AI : ignore composer / chip chrome — only message list text.
  if (el.closest("[data-slot='chat-input'], textarea, input, [data-slot='ui-context-chip']")) {
    return false
  }
  return Boolean(el.closest("[data-slot='chat-list'], [data-slot='chat-bubble']"))
}

export function ChatQuoteSelection({
  enabled,
  containerRef,
  onQuote,
  children,
}: ChatQuoteSelectionProps) {
  const [pos, setPos] = useState<ToolbarPos | null>(null)
  const [text, setText] = useState("")
  const pendingText = useRef("")

  const clearToolbar = useCallback(() => {
    setPos(null)
    setText("")
    pendingText.current = ""
  }, [])

  const syncFromSelection = useCallback(() => {
    if (!enabled) {
      clearToolbar()
      return
    }
    const container = containerRef.current
    const sel = window.getSelection()
    if (!container || !sel || !selectionInside(container, sel)) {
      clearToolbar()
      return
    }
    const raw = sel.toString().replace(/\r\n/g, "\n")
    if (!raw.trim()) {
      clearToolbar()
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const host = container.getBoundingClientRect()
    pendingText.current = raw
    setText(raw)
    setPos({
      top: rect.top - host.top - 36,
      left: Math.min(
        Math.max(8, rect.left - host.left + rect.width / 2),
        Math.max(8, host.width - 8),
      ),
    })
  }, [clearToolbar, containerRef, enabled])

  useEffect(() => {
    if (!enabled) {
      clearToolbar()
      return
    }
    const onUp = () => {
      // AI : wait a tick so the browser finishes updating the Selection after mouseup.
      requestAnimationFrame(syncFromSelection)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearToolbar()
    }
    document.addEventListener("mouseup", onUp)
    document.addEventListener("keyup", onUp)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mouseup", onUp)
      document.removeEventListener("keyup", onUp)
      document.removeEventListener("keydown", onKey)
    }
  }, [clearToolbar, enabled, syncFromSelection])

  function pinQuote() {
    const ref = uiContextRefFromChatQuote(pendingText.current || text)
    if (!ref) return
    onQuote(ref)
    window.getSelection()?.removeAllRanges()
    clearToolbar()
  }

  return (
    <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col">
      {children}
      {pos && text.trim() ? (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2"
          style={{ top: pos.top, left: pos.left }}
        >
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="pointer-events-auto h-7 gap-1 border border-border px-2 font-mono text-[10px] shadow-md"
            onMouseDown={(e) => {
              // AI : keep selection until click handler reads it.
              e.preventDefault()
            }}
            onClick={pinQuote}
            title="Add highlighted chat text as agent context"
            aria-label="Quote as context"
          >
            <Quote className="h-3 w-3" />
            Quote
          </Button>
        </div>
      ) : null}
    </div>
  )
}
