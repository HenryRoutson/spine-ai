"use client"

import { useState } from "react"
import { StructureCodeView } from "@/components/structure-code-view"
import { GeneratedTypesPanel } from "@/components/generated-types-panel"
import type { StructureModel, TypeAlias } from "@/lib/types"
import { cn } from "@/lib/utils"

type CodeMode = "live" | "generated"

// AI : Structure tab code view — live preview while editing, or server stubs for linting.
export function StructureTypesCodeSection({
  models,
  typeAliases,
}: {
  models: StructureModel[]
  typeAliases: TypeAlias[]
}) {
  const [mode, setMode] = useState<CodeMode>("live")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-border px-4 py-2">
        <div className="flex rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMode("live")}
            className={cn(
              "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
              mode === "live"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Live preview
          </button>
          <button
            type="button"
            onClick={() => setMode("generated")}
            className={cn(
              "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
              mode === "generated"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Lint stubs
          </button>
        </div>
      </div>

      {mode === "live" ? (
        <StructureCodeView models={models} typeAliases={typeAliases} />
      ) : (
        <GeneratedTypesPanel />
      )}
    </div>
  )
}
