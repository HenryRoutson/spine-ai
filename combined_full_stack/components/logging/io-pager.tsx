"use client"
// AI : parity ids — chrome.pager-prev chrome.pager-next

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { InputPreviewItem } from "@/lib/types"

type IoPagerProps = {
  items: InputPreviewItem[]
  renderItem: (item: InputPreviewItem, index: number) => ReactNode
}

function pagerItemsKey(items: InputPreviewItem[]): string {
  return items.map((i) => `${i.label}\0${i.text}`).join("\x01")
}

export function IoPager({ items, renderItem }: IoPagerProps) {
  const [index, setIndex] = useState(0)
  const itemsKey = useMemo(() => pagerItemsKey(items), [items])

  useEffect(() => {
    setIndex(0)
  }, [itemsKey])

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, items.length - 1)))
  }, [itemsKey, items.length])

  if (items.length <= 1) {
    return items[0] ? renderItem(items[0], 0) : null
  }

  const active = items[index] ?? items[0]!

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            data-spine-id="chrome.pager-prev"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Previous item"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={index >= items.length - 1}
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            data-spine-id="chrome.pager-next"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Next item"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
          {active.label}{" "}
          <span className="tabular-nums">
            ({index + 1}/{items.length})
          </span>
        </span>
      </div>
      {renderItem(active, index)}
    </>
  )
}
