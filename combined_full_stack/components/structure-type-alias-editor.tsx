"use client"

import { Trash2 } from "lucide-react"
import { TypeExprEditor } from "@/components/type-expr-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { typeExprHasUnset } from "@/lib/type-expr-edit"
import { formatTypeExprPy, tryParseTypeExprString } from "@/lib/type-expr-parse"
import { TypeAliasPreview } from "@/components/type-expr-preview"
import type { StructureModel, TypeAlias } from "@/lib/types"
import { cn } from "@/lib/utils"

export function StructureTypeAliasEditor({
  alias,
  models,
  typeAliases = [],
  locked,
  onUpdate,
  onDelete,
  onLockedInteract,
}: {
  alias: TypeAlias
  models: StructureModel[]
  typeAliases?: TypeAlias[]
  locked: boolean
  onUpdate: (patch: Partial<TypeAlias>) => void
  onDelete: () => void
  onLockedInteract?: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <Input
            value={alias.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            readOnly={locked}
            onPointerDown={locked ? onLockedInteract : undefined}
            onFocus={locked ? onLockedInteract : undefined}
            placeholder="Type name — e.g. quote_id_t"
            className="h-9 font-mono text-sm font-medium read-only:cursor-not-allowed"
          />
          <Input
            value={alias.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            readOnly={locked}
            onPointerDown={locked ? onLockedInteract : undefined}
            onFocus={locked ? onLockedInteract : undefined}
            placeholder="What this type represents…"
            className="h-8 text-xs text-muted-foreground read-only:cursor-not-allowed"
          />
        </div>
        {!locked && (
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div
        className={cn("rounded-lg border border-border bg-secondary/10 p-4", locked && "cursor-not-allowed")}
        onPointerDown={locked ? onLockedInteract : undefined}
      >
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Type expression
        </p>
        <div className={cn(locked && "pointer-events-none opacity-70")}>
          <TypeExprEditor
            expr={alias.expr}
            models={models}
            typeAliases={typeAliases.filter((t) => t.id !== alias.id)}
            onChange={(expr) => onUpdate({ expr })}
          />
        </div>
      </div>

      <TypeAliasPreview name={alias.name} expr={alias.expr} models={models} />

      {typeExprHasUnset(alias.expr) && (
        <p className="font-mono text-[10px] text-amber-600 dark:text-amber-500">
          Fill every UNSET slot before using `{alias.name || "this type"}` in a struct field.
        </p>
      )}

      <p className="font-mono text-[10px] text-muted-foreground">
        Reference in struct fields as{" "}
        <code className="text-foreground">{alias.name || "TypeName"}</code> or{" "}
        <code className="text-foreground">list[{alias.name || "TypeName"}]</code>
      </p>
    </div>
  )
}

export function TypeAliasTextSync({
  alias,
  models,
  locked,
  onUpdate,
  onLockedInteract,
}: {
  alias: TypeAlias
  models: StructureModel[]
  locked: boolean
  onUpdate: (patch: Partial<TypeAlias>) => void
  onLockedInteract?: () => void
}) {
  return (
    <div className="space-y-2">
      <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Paste Python type text
      </label>
      <Input
        defaultValue={formatTypeExprPy(alias.expr, models)}
        key={alias.id + formatTypeExprPy(alias.expr, models)}
        readOnly={locked}
        onPointerDown={locked ? onLockedInteract : undefined}
        onFocus={locked ? onLockedInteract : undefined}
        placeholder="e.g. list[int] | dict[str, str]"
        className="font-mono text-xs read-only:cursor-not-allowed"
        onBlur={(e) => {
          if (locked) return
          const raw = e.target.value.trim()
          if (!raw) return
          const parsed = tryParseTypeExprString(raw, models)
          if (parsed.ok) onUpdate({ expr: parsed.expr })
        }}
        onKeyDown={(e) => {
          if (locked || e.key !== "Enter") return
          e.preventDefault()
          const raw = e.currentTarget.value.trim()
          if (!raw) return
          const parsed = tryParseTypeExprString(raw, models)
          if (parsed.ok) onUpdate({ expr: parsed.expr })
        }}
      />
    </div>
  )
}
