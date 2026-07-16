"use client"

// AI : schema-guided JSON editor — form + raw JSON tabs (from edit_given_struct).

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tryParseJson } from "@/lib/json-utils"
import {
  applySchemaDefaults,
  defaultFromSchema,
  friendlyType,
  humanizeKey,
  jsonSchemaToFormRoot,
  validateFormData,
  type FormSchemaNode,
} from "@/lib/schema-form"
import { cn } from "@/lib/utils"

type json_text_string = string

export function SchemaJsonEditor({
  schema,
  text,
  onText,
  formOnly = false,
}: {
  schema: Record<string, unknown>
  text: json_text_string
  onText: (text: json_text_string) => void
  formOnly?: boolean
}) {
  const formRoot = useMemo(() => jsonSchemaToFormRoot(schema), [schema])
  const [mode, setMode] = useState<"form" | "json">("form")
  const [data, setData] = useState<unknown>(() => parseOrDefault(text, formRoot))
  const [jsonDraft, setJsonDraft] = useState(text)
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    const parsed = tryParseJson(text, { trim: true })
    if (!parsed.ok || parsed.value === null) return
    const normalized = formRoot ? applySchemaDefaults(parsed.value, formRoot) : parsed.value
    setData(normalized)
    setJsonDraft(JSON.stringify(normalized, null, 2))
    if (formRoot && JSON.stringify(normalized) !== JSON.stringify(parsed.value)) {
      onText(JSON.stringify(normalized, null, 2))
    }
  }, [text, formRoot, onText])

  const fieldErrors = formRoot ? validateFormData(data, formRoot) : {}
  const errorCount = Object.keys(fieldErrors).length

  const pushData = (next: unknown) => {
    const normalized = formRoot ? applySchemaDefaults(next, formRoot) : next
    setData(normalized)
    onText(JSON.stringify(normalized, null, 2))
    setJsonDraft(JSON.stringify(normalized, null, 2))
    setJsonError(null)
  }

  if (!formRoot) {
    return (
      <div className="space-y-1.5">
        <p className="font-mono text-[10px] text-muted-foreground">
          This step&apos;s output type is too complex for a guided form — edit as JSON.
        </p>
        <Textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          className="min-h-[120px] font-mono text-[11px]"
          spellCheck={false}
          autoFocus
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {!formOnly && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "form" | "json")}>
            <TabsList className="h-7">
              <TabsTrigger value="form" className="px-2.5 font-mono text-[10px]">
                guided form
              </TabsTrigger>
              <TabsTrigger value="json" className="px-2.5 font-mono text-[10px]">
                raw JSON
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {formOnly && <p className="font-mono text-[10px] text-muted-foreground">guided form</p>}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
            errorCount ? "bg-destructive/15 text-destructive" : "bg-chart-2/15 text-chart-2",
          )}
        >
          {errorCount ? `${errorCount} issue(s)` : "valid"}
        </span>
      </div>

      {(formOnly || mode === "form") ? (
        <div className="max-h-96 overflow-auto rounded border border-border bg-muted/10 p-3">
          {formRoot.title && formRoot.type === "object" && (
            <p className="text-sm font-semibold">{formRoot.title}</p>
          )}
          {formRoot.description && formRoot.type === "object" && (
            <p className="mb-3 text-xs text-muted-foreground">{formRoot.description}</p>
          )}
          {formRoot.type === "array" ? (
            <ArrayField
              node={formRoot}
              itemNode={formRoot.items ?? { key: "item", type: "string", required: true }}
              arr={Array.isArray(data) ? data : []}
              errors={fieldErrors}
              path=""
              onChange={(next) => pushData(next)}
            />
          ) : (
            <FormFields
              node={formRoot}
              data={data}
              errors={fieldErrors}
              path=""
              onChange={(next) => pushData(next)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Textarea
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            className="min-h-[120px] font-mono text-[11px]"
            spellCheck={false}
          />
          {jsonError && <p className="font-mono text-[10px] text-destructive">{jsonError}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 bg-transparent font-mono text-[10px]"
              onClick={() => {
                try {
                  setJsonDraft(JSON.stringify(JSON.parse(jsonDraft), null, 2))
                  setJsonError(null)
                } catch (e) {
                  setJsonError(`Invalid JSON: ${(e as Error).message}`)
                }
              }}
            >
              Format
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 font-mono text-[10px]"
              onClick={() => {
                const parsed = tryParseJson(jsonDraft, { trim: true })
                if (!parsed.ok) {
                  setJsonError(`Invalid JSON: ${parsed.error.message}`)
                  return
                }
                pushData(parsed.value)
                setJsonError(null)
              }}
            >
              Apply JSON
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function parseOrDefault(text: json_text_string, formRoot: FormSchemaNode | null): unknown {
  const parsed = tryParseJson(text, { trim: true })
  const fallback = formRoot ? defaultFromSchema(formRoot) : {}
  const base = parsed.ok && parsed.value !== null ? parsed.value : fallback
  return formRoot ? applySchemaDefaults(base, formRoot) : base
}

function FormFields({
  node,
  data,
  errors,
  path,
  onChange,
}: {
  node: FormSchemaNode
  data: unknown
  errors: Record<string, string>
  path: string
  onChange: (next: unknown) => void
}) {
  if (node.type === "object" && node.properties) {
    const obj = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<
      string,
      unknown
    >
    return (
      <div className={path ? "mt-2 space-y-3 border-l border-border pl-3" : "space-y-3"}>
        {Object.entries(node.properties).map(([key, sub]) => (
          <FormField
            key={key}
            fieldKey={key}
            node={sub}
            value={obj[key]}
            errors={errors}
            path={path ? `${path}.${key}` : key}
            onValue={(val) => onChange({ ...obj, [key]: val })}
          />
        ))}
      </div>
    )
  }

  if (node.type === "array") {
    const arr = Array.isArray(data) ? data : []
    const itemNode = node.items ?? { key: "item", type: "string" as const, required: true }
    return (
      <ArrayField
        node={node}
        itemNode={itemNode}
        arr={arr}
        errors={errors}
        path={path}
        onChange={onChange}
      />
    )
  }

  return null
}

function FormField({
  fieldKey,
  node,
  value,
  errors,
  path,
  onValue,
}: {
  fieldKey: string
  node: FormSchemaNode
  value: unknown
  errors: Record<string, string>
  path: string
  onValue: (val: unknown) => void
}) {
  const err = errors[path]
  const label = node.title || humanizeKey(fieldKey)

  if (node.type === "object" && node.properties) {
    return (
      <div className="rounded-md border border-border/70 bg-background/40 p-2.5">
        <FieldLabel label={label} node={node} />
        {node.description && <FieldDesc text={node.description} />}
        <FormFields
          node={node}
          data={value}
          errors={errors}
          path={path}
          onChange={onValue}
        />
        {err && <FieldErr msg={err} />}
      </div>
    )
  }

  if (node.type === "array") {
    const arr = Array.isArray(value) ? value : []
    const itemNode = node.items ?? { key: "item", type: "string" as const, required: true }
    return (
      <div>
        <FieldLabel label={label} node={node} />
        {node.description && <FieldDesc text={node.description} />}
        <ArrayField
          node={node}
          itemNode={itemNode}
          arr={arr}
          errors={errors}
          path={path}
          onChange={onValue}
        />
        {err && <FieldErr msg={err} />}
      </div>
    )
  }

  return (
    <div>
      <FieldLabel label={label} node={node} />
      {node.description && <FieldDesc text={node.description} />}
      <ScalarInput node={node} value={value} invalid={!!err} onValue={onValue} />
      {err && <FieldErr msg={err} />}
    </div>
  )
}

function ArrayField({
  node,
  itemNode,
  arr,
  errors,
  path,
  onChange,
}: {
  node: FormSchemaNode
  itemNode: FormSchemaNode
  arr: unknown[]
  errors: Record<string, string>
  path: string
  onChange: (next: unknown) => void
}) {
  return (
    <div className="space-y-2">
      {arr.map((item, idx) => {
        const itemPath = `${path}[${idx}]`
        return (
          <div key={idx} className="flex items-start gap-2">
            <div className="min-w-0 flex-1 rounded-md border border-border/60 bg-background/30 p-2">
              <p className="mb-1.5 font-mono text-[9px] uppercase text-muted-foreground">Item {idx + 1}</p>
              {itemNode.type === "object" && itemNode.properties ? (
                <FormFields
                  node={itemNode}
                  data={item}
                  errors={errors}
                  path={itemPath}
                  onChange={(next) => {
                    const copy = [...arr]
                    copy[idx] = next
                    onChange(copy)
                  }}
                />
              ) : (
                <>
                  <ScalarInput
                    node={itemNode}
                    value={item}
                    invalid={!!errors[itemPath]}
                    onValue={(next) => {
                      const copy = [...arr]
                      copy[idx] = next
                      onChange(copy)
                    }}
                  />
                  {errors[itemPath] && <FieldErr msg={errors[itemPath]!} />}
                </>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-1 h-7 w-7 shrink-0 text-muted-foreground"
              onClick={() => onChange(arr.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-transparent font-mono text-[10px]"
        onClick={() => {
          const d =
            itemNode.type === "object" && itemNode.properties
              ? defaultFromSchema(itemNode)
              : defaultFromSchema({ ...itemNode, type: itemNode.type === "array" ? "string" : itemNode.type })
          onChange([...arr, d])
        }}
      >
        <Plus className="mr-1 h-3 w-3" /> Add item
      </Button>
      {errors[path] && <FieldErr msg={errors[path]!} />}
    </div>
  )
}

function ScalarInput({
  node,
  value,
  invalid,
  onValue,
}: {
  node: FormSchemaNode
  value: unknown
  invalid: boolean
  onValue: (val: unknown) => void
}) {
  const cls = cn("h-8 text-xs", invalid && "border-destructive/70")

  if (node.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onValue(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-xs text-muted-foreground">{value === true ? "Yes" : "No"}</span>
      </label>
    )
  }

  if (node.enum) {
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onValue(e.target.value)}
        className={cn("w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs", invalid && "border-destructive/70")}
      >
        {!node.required && <option value="">—</option>}
        {node.enum.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  if (node.type === "integer" || node.type === "number") {
    return (
      <Input
        type="number"
        step={node.type === "integer" ? 1 : "any"}
        value={typeof value === "number" ? value : ""}
        onChange={(e) => {
          const raw = e.target.value
          if (!raw.trim()) {
            onValue(node.nullable ? null : undefined)
            return
          }
          const n = node.type === "integer" ? parseInt(raw, 10) : parseFloat(raw)
          onValue(Number.isNaN(n) ? (node.nullable ? null : undefined) : n)
        }}
        className={cls}
      />
    )
  }

  const longText =
    (node.maxLength ?? 0) > 200 || node.format === "uri" || (node.description?.length ?? 0) > 80
  if (longText) {
    return (
      <Textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => {
          const raw = e.target.value
          onValue(raw === "" && node.nullable ? null : raw)
        }}
        className={cn("min-h-[72px] font-mono text-[11px]", invalid && "border-destructive/70")}
        spellCheck={false}
      />
    )
  }

  return (
    <Input
      type={node.format === "email" ? "email" : "text"}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => {
        const raw = e.target.value
        onValue(raw === "" && node.nullable ? null : raw)
      }}
      className={cls}
    />
  )
}

function FieldLabel({ label, node }: { label: string; node: FormSchemaNode }) {
  return (
    <div className="mb-1 flex items-baseline gap-2">
      <span className="text-xs font-medium">{label}</span>
      <span className={cn("text-[9px] font-semibold uppercase", node.required ? "text-destructive/80" : "text-muted-foreground")}>
        {node.required ? "required" : "optional"}
      </span>
      <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
        {friendlyType(node)}
      </span>
    </div>
  )
}

function FieldDesc({ text }: { text: string }) {
  return <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">{text}</p>
}

function FieldErr({ msg }: { msg: string }) {
  return <p className="mt-1 font-mono text-[10px] text-destructive">{msg}</p>
}
