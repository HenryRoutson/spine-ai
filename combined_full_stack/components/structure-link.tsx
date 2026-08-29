"use client"

import { useOptionalAppShell } from "@/lib/app-shell"
import type { StructureModel, StructureModelId } from "@/lib/types"
import { modelName } from "@/lib/validity"
import { cn } from "@/lib/utils"

// AI : inline link to jump from pipeline / inference UI to a structure in the Structure tab.
export function StructureLink({
  models,
  structureId,
  fallback = "·",
  className,
}: {
  models: StructureModel[]
  structureId?: StructureModelId
  fallback?: string
  className?: string
}) {
  const shell = useOptionalAppShell()
  const name = structureId ? modelName(models, structureId) : undefined
  const label = name ?? fallback

  if (!structureId || !name || !shell) {
    return <span className={className}>{label}</span>
  }

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        shell.openStructure(structureId)
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        e.stopPropagation()
        shell.openStructure(structureId)
      }}
      className={cn(
        "cursor-pointer text-primary underline-offset-2 hover:underline",
        className,
      )}
      title={`Open ${name} in Structure tab`}
    >
      {label}
    </span>
  )
}
