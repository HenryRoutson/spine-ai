"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { InputPreviewItem } from "@/lib/types"

type IoPagerProps = {
  items: InputPreviewItem[]
  renderItem: (item: InputPreviewItem, index: number) => ReactNode
}

export function IoPager({ items, renderItem }: IoPagerProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [items])

  if (items.length <= 1) {
    return items[0] ? renderItem(items[0], 0) : null
  }

  const active = items[index] ?? items[0]!

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Previous item"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-muted-foreground">
          {active.label}{" "}
          <span className="tabular-nums">
            ({index + 1}/{items.length})
          </span>
        </span>
        <button
          type="button"
          disabled={index >= items.length - 1}
          onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Next item"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {renderItem(active, index)}
    </>
  )
}
