"use client"
// AI : parity ids — chrome.pager-prev chrome.pager-next

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  bindHtmlPagers,
  HTML_PAGER_BOOT,
  HTML_PAGER_BTN_CLASS,
  HTML_PAGER_ITEM_LABEL_ATTR,
  HTML_PAGER_LABEL_COUNT_PROPS,
  HTML_PAGER_LABEL_TEXT_PROPS,
  HTML_PAGER_NEXT_PROPS,
  HTML_PAGER_PAGES_PROPS,
  HTML_PAGER_PREV_PROPS,
  HTML_PAGER_ROOT_PROPS,
  pagerCountLabel,
} from "@/lib/html-pager"
import type { InputPreviewItem } from "@/lib/types"

type IoPagerProps = {
  items: InputPreviewItem[]
  renderItem: (item: InputPreviewItem, index: number) => ReactNode
}

function pagerItemsKey(items: InputPreviewItem[]): string {
  return items.map((i) => `${i.label}\0${i.text}`).join("\x01")
}

export function IoPager({ items, renderItem }: IoPagerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const itemsKey = useMemo(() => pagerItemsKey(items), [items])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    return bindHtmlPagers(el, HTML_PAGER_BOOT)
  }, [itemsKey])

  if (items.length <= 1) {
    return items[0] ? renderItem(items[0], 0) : null
  }

  const first = items[0]!

  return (
    <div ref={rootRef} {...HTML_PAGER_ROOT_PROPS}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled
            data-spine-id="chrome.pager-prev"
            {...HTML_PAGER_PREV_PROPS}
            className={HTML_PAGER_BTN_CLASS}
            aria-label="Previous item"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-spine-id="chrome.pager-next"
            {...HTML_PAGER_NEXT_PROPS}
            className={HTML_PAGER_BTN_CLASS}
            aria-label="Next item"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
          <span {...HTML_PAGER_LABEL_TEXT_PROPS}>{first.label}</span>{" "}
          <span className="tabular-nums" {...HTML_PAGER_LABEL_COUNT_PROPS}>
            {pagerCountLabel(0, items.length)}
          </span>
        </span>
      </div>
      <div {...HTML_PAGER_PAGES_PROPS}>
        {items.map((item, i) => (
          <div
            key={`${item.label}:${i}`}
            {...{ [HTML_PAGER_ITEM_LABEL_ATTR]: item.label }}
            hidden={i !== 0}
          >
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    </div>
  )
}
