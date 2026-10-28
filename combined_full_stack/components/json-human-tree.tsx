"use client"

// AI : compact human tree from atomic_code/json_viewer_demo — no JSON punctuation, values can be links.

import { useState } from "react"
import { humanizeKey } from "@/lib/schema-form"
import { cn } from "@/lib/utils"

export type json_human_link = {
  value: string
  hint: string
  onOpen: () => void
}

function leafKind(val: unknown): "string" | "number" | "boolean" | "null" | "date" {
  if (val === null || val === undefined) return "null"
  if (typeof val === "boolean") return "boolean"
  if (typeof val === "number") return "number"
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return "date"
  return "string"
}

function leafText(val: unknown, kind: ReturnType<typeof leafKind>): string {
  if (kind === "null") return "—"
  if (kind === "boolean") return val ? "Yes" : "No"
  if (kind === "date" && typeof val === "string") {
    const d = new Date(val)
    return Number.isNaN(d.getTime()) ? val : d.toLocaleDateString()
  }
  return String(val)
}

function matchLink(val: unknown, links: json_human_link[]): json_human_link | undefined {
  if (typeof val !== "string" && typeof val !== "number") return undefined
  const key = String(val).toLowerCase()
  return links.find((link) => link.value.toLowerCase() === key)
}

function TreeRow({
  label,
  val,
  depth,
  links,
}: {
  label: string
  val: unknown
  depth: number
  links: json_human_link[]
}) {
  const isArr = Array.isArray(val)
  const isObj = Boolean(val && typeof val === "object" && !isArr)
  const [open, setOpen] = useState(depth < 1)
  const count = isArr ? val.length : isObj ? Object.keys(val as object).length : 0

  if (isObj || isArr) {
    const entries = isArr
      ? val.map((item, i) => [String(i + 1), item] as const)
      : Object.entries(val as Record<string, unknown>)
    return (
      <div>
        <button
          type="button"
          className="flex w-full items-baseline gap-1 rounded px-1 py-0.5 text-left hover:bg-muted/40"
          style={{ paddingLeft: 4 + depth * 14 }}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="w-3 shrink-0 text-[9px] text-muted-foreground">{open ? "▼" : "▶"}</span>
          <span className="text-[12px] font-medium text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground">
            {count} {isArr ? "item" : "field"}
            {count === 1 ? "" : "s"}
          </span>
        </button>
        {open ? (
          <div className="border-l border-border/70 ml-[11px]">
            {entries.map(([k, child]) => (
              <TreeRow
                key={k}
                label={isArr ? `Item ${k}` : humanizeKey(k.replace(/-/g, "_"))}
                val={child}
                depth={depth + 1}
                links={links}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const kind = leafKind(val)
  const text = leafText(val, kind)
  const link = matchLink(val, links)
  const color =
    kind === "number"
      ? "text-blue-400"
      : kind === "boolean"
        ? "text-violet-400"
        : kind === "null"
          ? "text-muted-foreground italic"
          : kind === "date"
            ? "text-cyan-400"
            : "text-emerald-400"

  return (
    <div
      className="flex items-baseline gap-1 px-1 py-0.5"
      style={{ paddingLeft: 4 + depth * 14 }}
    >
      <span className="w-3 shrink-0" />
      <span className="shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <span className="min-w-2 flex-1 border-b border-dotted border-border/80 mx-1 mb-0.5" />
      {link ? (
        <button
          type="button"
          title={link.hint}
          onClick={link.onOpen}
          className="max-w-[12rem] truncate text-[12px] text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {text}
        </button>
      ) : (
        <span className={cn("max-w-[12rem] truncate text-[12px]", color)}>{text}</span>
      )}
    </div>
  )
}

export function JsonHumanTree({
  value,
  links = [],
  className,
}: {
  value: unknown
  links?: json_human_link[]
  className?: string
}) {
  if (value === null || value === undefined) {
    return <p className="px-1 text-[11px] italic text-muted-foreground">Empty</p>
  }
  if (typeof value !== "object") {
    return <TreeRow label="Value" val={value} depth={0} links={links} />
  }
  const entries = Array.isArray(value)
    ? value.map((item, i) => [String(i + 1), item] as const)
    : Object.entries(value as Record<string, unknown>)
  return (
    <div className={cn("py-0.5", className)}>
      {entries.map(([k, child]) => (
        <TreeRow
          key={k}
          label={Array.isArray(value) ? `Item ${k}` : humanizeKey(k.replace(/-/g, "_"))}
          val={child}
          depth={0}
          links={links}
        />
      ))}
    </div>
  )
}
