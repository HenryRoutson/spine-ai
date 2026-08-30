"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, ExternalLink, Plus, X } from "lucide-react"
import { DeleteButton } from "@/components/delete-button"
import { JsonHumanTree, type json_human_link } from "@/components/json-human-tree"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { tableNameForModel } from "@/lib/app-sql"
import { useOptionalAppShell } from "@/lib/app-shell"
import { copyTextToClipboard } from "@/lib/clipboard"
import { spineActionProps } from "@/lib/core/parity"
import {
  actionPageTag,
  hostedActionBinding,
  hostedActionPayload,
  humanizeActionAlias,
  isHostedActionAlias,
  slugActionAlias,
  type HostedSiteActionBinding,
} from "@/lib/hosted-site-actions"
import type { pipeline_function_id } from "@/lib/pipeline-functions"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import { useOptionalStore } from "@/lib/store"
import type { StructureModel } from "@/lib/types"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { cn } from "@/lib/utils"

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <Label htmlFor={htmlFor} className="text-[10px] font-medium text-muted-foreground">
      {children}
    </Label>
  )
}

function ActionRow({
  row,
  tables,
  functions,
  onPatch,
  onRemove,
  onOpenFunction,
  onOpenTable,
}: {
  row: HostedSiteActionBinding
  tables: string[]
  functions: { id: string; name: string }[]
  onPatch: (next: Partial<HostedSiteActionBinding>) => void
  onRemove: () => void
  onOpenFunction: (functionId: string) => void
  onOpenTable: (table: string) => void
}) {
  // AI : draft alias so keystrokes are not dropped when the parent remounts on alias change.
  const [aliasDraft, setAliasDraft] = useState(row.alias)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    setAliasDraft(row.alias)
  }, [row.alias])

  const payload = hostedActionPayload(row)
  const fn = functions.find((f) => f.id === row.functionId)
  const tag = actionPageTag(row.alias)
  const aliasInputId = `action-alias-${row.alias}`
  const labelInputId = `action-label-${row.alias}`
  const titleInputId = `action-title-${row.alias}`
  const tableSelectId = `action-table-${row.alias}`
  const fnSelectId = `action-fn-${row.alias}`

  const links = useMemo((): json_human_link[] => {
    const out: json_human_link[] = []
    if (fn) {
      out.push({
        value: fn.name,
        hint: `Open ${fn.name}`,
        onOpen: () => onOpenFunction(fn.id),
      })
      out.push({
        value: fn.id,
        hint: `Open ${fn.name}`,
        onOpen: () => onOpenFunction(fn.id),
      })
    }
    out.push({
      value: row.alias,
      hint: fn ? `Open ${fn.name}` : `Page tag ${tag}`,
      onOpen: () => {
        if (fn) onOpenFunction(fn.id)
        else void copyTag()
      },
    })
    if (row.table) {
      out.push({
        value: row.table,
        hint: `Open table ${row.table}`,
        onOpen: () => onOpenTable(row.table!),
      })
    }
    for (const f of functions) {
      if (out.some((l) => l.value.toLowerCase() === f.name.toLowerCase())) continue
      out.push({
        value: f.name,
        hint: `Open ${f.name}`,
        onOpen: () => onOpenFunction(f.id),
      })
    }
    for (const t of tables) {
      if (out.some((l) => l.value.toLowerCase() === t.toLowerCase())) continue
      out.push({
        value: t,
        hint: `Open table ${t}`,
        onOpen: () => onOpenTable(t),
      })
    }
    return out
  }, [fn, functions, onOpenFunction, onOpenTable, row.alias, row.table, tables, tag])

  async function copyTag() {
    await copyTextToClipboard(tag)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <FieldLabel htmlFor={labelInputId}>Button on the page</FieldLabel>
          <Input
            id={labelInputId}
            value={row.label}
            className="h-7 text-[12px]"
            onChange={(e) => onPatch({ label: e.target.value })}
            {...spineActionProps("website.action-label")}
          />
        </div>
        <DeleteButton
          type="button"
          variant="ghost"
          size="icon"
          className="mt-4 h-7 w-7 shrink-0"
          label={`Remove ${row.label}`}
          onClick={onRemove}
          {...spineActionProps("website.remove-action")}
        >
          <X className="h-3 w-3" />
        </DeleteButton>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel htmlFor={fnSelectId}>Runs this function</FieldLabel>
          <div className="flex items-center gap-1">
            <select
              id={fnSelectId}
              value={row.functionId ?? ""}
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[12px]"
              onChange={(e) => onPatch({ functionId: e.target.value || undefined })}
              {...spineActionProps("website.action-function")}
            >
              <option value="">{functions.length ? "Pick a function" : "No functions yet"}</option>
              {functions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {fn ? (
              <button
                type="button"
                title={`Open ${fn.name}`}
                className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-[10px] text-primary underline decoration-primary/40 underline-offset-2 hover:bg-accent hover:decoration-primary"
                onClick={() => onOpenFunction(fn.id)}
                {...spineActionProps("website.action-open-function")}
              >
                {fn.name}
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor={tableSelectId}>Reads / writes table</FieldLabel>
          <div className="flex items-center gap-1">
            <select
              id={tableSelectId}
              value={row.table ?? ""}
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[12px]"
              onChange={(e) => onPatch({ table: e.target.value || undefined })}
              {...spineActionProps("website.action-table")}
            >
              <option value="">None</option>
              {tables.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {row.table ? (
              <button
                type="button"
                title={`Open ${row.table}`}
                className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-[10px] text-primary underline decoration-primary/40 underline-offset-2 hover:bg-accent hover:decoration-primary"
                onClick={() => onOpenTable(row.table!)}
                {...spineActionProps("website.action-open-table")}
              >
                {row.table}
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">Sends this when clicked</p>
        <div
          className="rounded-md border border-border bg-muted/20 px-1 py-1"
          {...spineActionProps("website.action-payload")}
        >
          <JsonHumanTree value={payload} links={links} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel htmlFor={aliasInputId}>Page tag</FieldLabel>
          <div className="flex items-center gap-1">
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{"{{action:"}</span>
            <Input
              id={aliasInputId}
              value={aliasDraft}
              className="h-7 min-w-0 flex-1 font-mono text-[11px]"
              onChange={(e) => {
                const next = e.target.value.trim().toLowerCase()
                setAliasDraft(next)
                if (isHostedActionAlias(next)) onPatch({ alias: next })
              }}
              onBlur={() => {
                if (!isHostedActionAlias(aliasDraft)) setAliasDraft(row.alias)
              }}
              {...spineActionProps("website.action-alias")}
            />
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{"}}"}</span>
            <button
              type="button"
              title="Copy page tag"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => void copyTag()}
              {...spineActionProps("website.action-copy-tag")}
            >
              <Copy className="h-3 w-3" />
              <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          {copied ? <p className="text-[10px] text-muted-foreground">Copied {tag}</p> : null}
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor={titleInputId}>Card heading</FieldLabel>
          <Input
            id={titleInputId}
            value={row.title ?? ""}
            placeholder={row.label || "Same as button"}
            className="h-7 text-[12px]"
            onChange={(e) => onPatch({ title: e.target.value || undefined })}
            {...spineActionProps("website.action-title")}
          />
        </div>
      </div>
    </div>
  )
}

export function WebsiteActionBindings({
  options,
  models,
  functions = [],
  onChange,
  className,
}: {
  options: HostedSiteOptions
  models: StructureModel[]
  functions?: { id: string; name: string }[]
  onChange: (next: HostedSiteOptions) => void
  className?: string
}) {
  const store = useOptionalStore()
  const shell = useOptionalAppShell()
  const tables = models
    .filter((m) => !m.auto)
    .map((m) => tableNameForModel(m))
    .filter((name, i, all) => all.indexOf(name) === i)

  function update(actions: HostedSiteActionBinding[]) {
    onChange({ ...options, actions })
  }

  function openFunction(functionId: string) {
    if (!shell || !store) return
    store.setActiveFunction(functionId as pipeline_function_id)
    shell.clearWebsiteEditor()
    shell.openPipeline()
  }

  function openTable(table: string) {
    if (!shell) return
    const model = models.find((m) => !m.auto && tableNameForModel(m) === table)
    shell.clearWebsiteEditor()
    shell.openStructure(model?.id)
  }

  function add() {
    const used = new Set(options.actions.map((a) => a.alias))
    const usedFns = new Set(options.actions.map((a) => a.functionId).filter(Boolean))
    const fn = functions.find((f) => !usedFns.has(f.id)) ?? functions[0]
    const alias = slugActionAlias(fn?.name ?? "run", used)
    update([
      ...options.actions,
      {
        alias,
        label: fn?.name ?? humanizeActionAlias(alias),
        table: tables[0],
        functionId: fn?.id,
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
          const payload = merged.payload ?? { action: alias }
          const nextPayload = payload.action === alias ? { ...payload, action: next.alias } : payload
          return { ...merged, alias: next.alias, payload: nextPayload }
        }
        return merged
      }),
    )
  }

  const fallback = hostedActionBinding(options.actions)

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium">Page buttons</p>
      <p className="text-[10px] text-muted-foreground">
        Each button runs a function. Click a name to open it. The file it sends is shown as a tree — not raw JSON.
      </p>
      {options.actions.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          None yet. Add a button, pick a function, and put {`{{action}}`} on the page — or ask Vibe.
        </p>
      ) : null}
      <div className="space-y-2">
        {options.actions.map((row) => (
          <ActionRow
            key={row.alias}
            row={row}
            tables={tables}
            functions={functions}
            onPatch={(next) => patch(row.alias, next)}
            onRemove={() => update(options.actions.filter((a) => a.alias !== row.alias))}
            onOpenFunction={openFunction}
            onOpenTable={openTable}
          />
        ))}
      </div>
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={add}
        {...spineActionProps("website.add-action")}
      >
        <Plus className="h-3 w-3" />
        Add button
      </button>
      {options.actions.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Bare {`{{action}}`} on the page uses the first button (
          <button
            type="button"
            className="text-primary underline decoration-primary/40 underline-offset-2"
            onClick={() => {
              if (fallback.functionId) openFunction(fallback.functionId)
            }}
          >
            {fallback.label}
          </button>
          ).
        </p>
      ) : null}
    </div>
  )
}
