"use client"

import type { ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  TYPE_KIND_OPTIONS,
  appendTupleArg,
  appendUnionVariant,
  childPaths,
  exprFromKindPick,
  getAtPath,
  removeChildAt,
  setAtPath,
  type TypeKindPick,
  type TypePath,
} from "@/lib/type-expr-edit"
import { formatTypeExprPy } from "@/lib/type-expr-parse"
import { TypeExprHighlight } from "@/components/type-expr-preview"
import type { TypeExpr } from "@/lib/server/type_expr"
import { PrimName, TypeExprKind, UNSET_TYPE_EXPR } from "@/lib/server/type_expr"
import type { StructureModel, StructureModelId, TypeAlias } from "@/lib/types"
import { cn } from "@/lib/utils"

function kindLabel(expr: TypeExpr, models: StructureModel[]): string {
  switch (expr.kind) {
    case TypeExprKind.Prim:
      return expr.name === PrimName.Text ? "str" : expr.name
    case TypeExprKind.List:
      return "list"
    case TypeExprKind.Map:
      return "dict"
    case TypeExprKind.Set:
      return "set"
    case TypeExprKind.Optional:
      return "Optional"
    case TypeExprKind.Union:
      return "union"
    case TypeExprKind.Generic:
      return expr.name === "tuple" ? "tuple" : expr.name
    case TypeExprKind.Ref:
      return models.find((m) => m.id === expr.modelId)?.name ?? "model"
    case TypeExprKind.Named:
      return expr.name
    case TypeExprKind.Unset:
      return "UNSET"
    case TypeExprKind.Document:
      return "Document"
    case TypeExprKind.Quote:
      return "Quote"
    case TypeExprKind.TextQuote:
      return "TextQuote"
    default:
      return expr.kind
  }
}

function KindPicker({
  models,
  typeAliases = [],
  onPick,
  className,
  children,
}: {
  models: StructureModel[]
  typeAliases?: TypeAlias[]
  onPick: (pick: TypeKindPick, modelId?: StructureModelId, aliasName?: string) => void
  className?: string
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("inline-flex", className)}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider">
            Insert type
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {TYPE_KIND_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.id}
              className="font-mono text-xs"
              onClick={() => onPick(opt.id)}
            >
              <span>{opt.label}</span>
              {opt.hint && <span className="ml-auto text-[10px] text-muted-foreground">{opt.hint}</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {typeAliases.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider">
                Project types
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              {typeAliases.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  className="font-mono text-xs"
                  onClick={() => onPick("named", undefined, t.name)}
                >
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
        {models.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider">
                Models
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              {models.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  className="font-mono text-xs"
                  onClick={() => onPick("model", m.id as StructureModelId)}
                >
                  {m.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TypeExprNode({
  expr,
  path,
  models,
  typeAliases,
  depth,
  onChange,
}: {
  expr: TypeExpr
  path: TypePath
  models: StructureModel[]
  typeAliases?: TypeAlias[]
  depth: number
  onChange: (next: TypeExpr) => void
}) {
  const node = getAtPath(expr, path)

  const replace = (next: TypeExpr) => onChange(setAtPath(expr, path, next))
  const pickType = (pick: TypeKindPick, modelId?: StructureModelId, aliasName?: string) => {
    if (aliasName) replace({ kind: "named", name: aliasName })
    else replace(exprFromKindPick(pick, models, modelId))
  }

  if (node.kind === "unset") {
    return (
      <KindPicker
        models={models}
        typeAliases={typeAliases}
        onPick={pickType}
        className="rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-1 font-mono text-[11px] text-primary hover:bg-primary/10"
      >
        + pick type
      </KindPicker>
    )
  }

  if (node.kind === "named") {
    return (
      <div className="inline-flex items-center gap-1">
        <Input
          value={node.name}
          onChange={(e) => replace({ kind: "named", name: e.target.value || "custom_t" })}
          className="h-7 w-32 font-mono text-[11px]"
        />
        <KindPicker
          models={models}
          typeAliases={typeAliases}
          onPick={pickType}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 font-mono text-[10px]")}
        >
          change
        </KindPicker>
      </div>
    )
  }

  if (node.kind === "ref") {
    return (
      <div className="inline-flex items-center gap-1">
        <select
          value={node.modelId}
          onChange={(e) => replace({ kind: "ref", modelId: e.target.value as StructureModelId })}
          className="h-7 rounded-md border border-border bg-background px-2 font-mono text-[11px]"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <KindPicker
          models={models}
          typeAliases={typeAliases}
          onPick={pickType}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 font-mono text-[10px]")}
        >
          change
        </KindPicker>
      </div>
    )
  }

  if (node.kind === "prim" || node.kind === "document" || node.kind === "quote" || node.kind === "text_quote") {
    return (
      <div className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/30 px-2 py-1">
        <span className="font-mono text-[11px]">{kindLabel(node, models)}</span>
        <KindPicker
          models={models}
          typeAliases={typeAliases}
          onPick={pickType}
          className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          edit
        </KindPicker>
      </div>
    )
  }

  const containerLabel = kindLabel(node, models)
  const isUnion = node.kind === "union"
  const isTuple = node.kind === "generic" && node.name === "tuple"
  const children = childPaths(node, [])

  return (
    <div
      className={cn(
        "inline-flex flex-col gap-1.5 rounded-lg border border-border bg-card/40 p-2",
        depth > 0 && "ml-1",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {containerLabel}
        </span>
        {(isUnion || isTuple) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 font-mono text-[10px]"
            onClick={() =>
              onChange(isUnion ? appendUnionVariant(expr, path) : appendTupleArg(expr, path))
            }
          >
            <Plus className="h-3 w-3" />
            add
          </Button>
        )}
        <KindPicker
          models={models}
          typeAliases={typeAliases}
          onPick={pickType}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 px-1.5 font-mono text-[10px]")}
        >
          wrap
        </KindPicker>
      </div>
      <div className="flex flex-col gap-2 border-l border-border/60 pl-2">
        {children.map(({ label, path: childRel }) => (
          <div key={childRel.join(".")} className="flex flex-wrap items-start gap-2">
            <span className="mt-1 shrink-0 font-mono text-[9px] uppercase text-muted-foreground">
              {label}
            </span>
            <TypeExprNode
              expr={expr}
              path={[...path, ...childRel]}
              models={models}
              typeAliases={typeAliases}
              depth={depth + 1}
              onChange={onChange}
            />
            {(isUnion || isTuple) && children.length > 2 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(removeChildAt(expr, path, childRel[0]!))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TypeExprEditor({
  expr,
  models,
  typeAliases = [],
  onChange,
  className,
}: {
  expr: TypeExpr
  models: StructureModel[]
  typeAliases?: TypeAlias[]
  onChange: (next: TypeExpr) => void
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <TypeExprNode
        expr={expr}
        path={[]}
        models={models}
        typeAliases={typeAliases}
        depth={0}
        onChange={onChange}
      />
      <TypeExprHighlight text={formatTypeExprPy(expr, models)} className="text-[11px]" />
    </div>
  )
}

export function defaultPlaygroundExpr(): TypeExpr {
  return { kind: "list", item: UNSET_TYPE_EXPR }
}
