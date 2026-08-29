"use client"

import { Plus, X } from "lucide-react"
import { DeleteButton } from "@/components/delete-button"
import { Input } from "@/components/ui/input"
import { tableNameForModel } from "@/lib/app-sql"
import {
  hostedActionBinding,
  humanizeActionAlias,
  isHostedActionAlias,
  type HostedSiteActionBinding,
} from "@/lib/hosted-site-actions"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import type { StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { spineActionProps } from "@/lib/core/parity"

function parsePayload(raw: string, alias: string): Record<string, unknown> {
  const trimmed = raw.trim()
  if (!trimmed) return { action: alias }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // AI : keep the last valid payload — invalid JSON stays as { action }
  }
  return { action: alias }
}

export function WebsiteActionBindings({
  options,
  models,
  onChange,
  className,
}: {
  options: HostedSiteOptions
  models: StructureModel[]
  onChange: (next: HostedSiteOptions) => void
  className?: string
}) {
  const tables = models
    .filter((m) => !m.auto)
    .map((m) => tableNameForModel(m))
    .filter((name, i, all) => all.indexOf(name) === i)

  function update(actions: HostedSiteActionBinding[]) {
    onChange({ ...options, actions })
  }

  function add() {
    const used = new Set(options.actions.map((a) => a.alias))
    let n = options.actions.length + 1
    let alias = `action${n}`
    while (used.has(alias)) {
      n += 1
      alias = `action${n}`
    }
    update([
      ...options.actions,
      {
        alias,
        label: humanizeActionAlias(alias),
        table: tables[0],
        payload: { action: alias },
      },
    ])
  }

  function patch(alias: string, next: Partial<HostedSiteActionBinding>) {
    update(
      options.actions.map((row) => {
        if (row.alias !== alias) return row
        const merged = { ...row, ...next }
        if (next.alias && isHostedActionAlias(next.alias) && next.alias !== alias) {
          return { ...merged, alias: next.alias }
        }
        return merged
      }),
    )
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium">SQL actions</p>
      <p className="text-[10px] text-muted-foreground">
        Each {`{{action:alias}}`} button. Label, table, and trigger JSON are editable — Vibe can set these too.
      </p>
      {options.actions.length === 0 ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          No actions yet — {`{{action}}`} uses the first button you add, or humanizes the alias.
        </p>
      ) : null}
      <div className="space-y-2">
        {options.actions.map((row) => (
          <div key={row.alias} className="rounded-md border border-border bg-background p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <Input
                value={row.alias}
                className="h-7 font-mono text-[11px]"
                onChange={(e) => {
                  const next = e.target.value.trim().toLowerCase()
                  if (isHostedActionAlias(next)) patch(row.alias, { alias: next })
                }}
                {...spineActionProps("website.action-alias")}
              />
              <Input
                value={row.label}
                className="h-7 text-[11px]"
                onChange={(e) => patch(row.alias, { label: e.target.value })}
                {...spineActionProps("website.action-label")}
              />
              <Input
                value={row.title ?? ""}
                placeholder="Card title"
                className="h-7 text-[11px]"
                onChange={(e) => patch(row.alias, { title: e.target.value || undefined })}
                {...spineActionProps("website.action-title")}
              />
              <select
                value={row.table ?? ""}
                className="h-7 rounded-md border border-input bg-background px-2 font-mono text-[11px]"
                onChange={(e) => patch(row.alias, { table: e.target.value || undefined })}
                {...spineActionProps("website.action-table")}
              >
                <option value="">Table (optional)</option>
                {tables.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                value={JSON.stringify(row.payload ?? { action: row.alias })}
                className="h-7 flex-1 font-mono text-[11px]"
                onChange={(e) => patch(row.alias, { payload: parsePayload(e.target.value, row.alias) })}
                {...spineActionProps("website.action-payload")}
              />
              <DeleteButton
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                label={`Remove ${row.label}`}
                onClick={() => update(options.actions.filter((a) => a.alias !== row.alias))}
                {...spineActionProps("website.remove-action")}
              >
                <X className="h-3 w-3" />
              </DeleteButton>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border px-2 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={add}
        {...spineActionProps("website.add-action")}
      >
        <Plus className="h-3 w-3" />
        Add action
      </button>
      {options.actions.length > 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">
          Default {`{{action}}`} → {hostedActionBinding(options.actions).alias}
        </p>
      ) : null}
    </div>
  )
}
