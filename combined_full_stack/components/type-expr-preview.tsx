"use client"

import type { TypeExpr } from "@/lib/server/type_expr"
import { typeExprToPy, typeExprToTs } from "@/lib/server/type_expr"
import type { StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"

const TYPE_TOKEN_RE = /(\[\]|\||<|>|,|\[|\]|\(|\)|=|\s+|type\b|[A-Za-z_]\w*)/g

const KEYWORDS = new Set([
  "Optional",
  "Union",
  "list",
  "dict",
  "tuple",
  "set",
  "Record",
  "Set",
  "type",
])

const PRIMS = new Set([
  "str",
  "int",
  "float",
  "bool",
  "string",
  "number",
  "boolean",
  "never",
  "undefined",
  "unknown",
  "Any",
  "null",
])

const SPECIAL = new Set(["Document", "Quote", "TextQuote", "FileInput"])

type TypeTokenKind = "punct" | "keyword" | "prim" | "special" | "typeName" | "unset" | "plain"

function tokenKind(token: string): TypeTokenKind {
  if (/^\s+$/.test(token)) return "plain"
  if (/^[\[\]|<>(),=]$/.test(token) || token === "[]") return "punct"
  if (token === "type") return "keyword"
  if (token === "UNSET") return "unset"
  if (KEYWORDS.has(token)) return "keyword"
  if (PRIMS.has(token)) return "prim"
  if (SPECIAL.has(token)) return "special"
  if (/^[A-Za-z_]\w*$/.test(token)) return "typeName"
  return "plain"
}

const TOKEN_CLASS: Record<TypeTokenKind, string> = {
  punct: "text-muted-foreground/60",
  keyword: "text-chart-4",
  prim: "text-chart-3",
  special: "text-chart-2",
  typeName: "text-primary",
  unset: "text-amber-500 dark:text-amber-400",
  plain: "text-foreground",
}

export function TypeExprHighlight({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const tokens = text.match(TYPE_TOKEN_RE) ?? [text]
  return (
    <pre className={cn("overflow-x-auto font-mono text-[11px] leading-relaxed", className)}>
      <code>
        {tokens.map((token, i) => (
          <span key={i} className={TOKEN_CLASS[tokenKind(token)]}>
            {token}
          </span>
        ))}
      </code>
    </pre>
  )
}

function aliasDeclarationPy(name: string, expr: TypeExpr, models: StructureModel[]): string {
  const body = typeExprToPy(expr, models)
  const label = name.trim()
  return label ? `type ${label} = ${body}` : body
}

function aliasDeclarationTs(name: string, expr: TypeExpr, models: StructureModel[]): string {
  const body = typeExprToTs(expr, models)
  const label = name.trim()
  return label ? `type ${label} = ${body}` : body
}

export function TypeAliasPreview({
  name,
  expr,
  models,
  className,
}: {
  name?: string
  expr: TypeExpr
  models: StructureModel[]
  className?: string
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Python
        </p>
        <TypeExprHighlight text={aliasDeclarationPy(name ?? "", expr, models)} />
      </div>
      <div className="rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          TypeScript
        </p>
        <TypeExprHighlight text={aliasDeclarationTs(name ?? "", expr, models)} />
      </div>
    </div>
  )
}
