"use client"

import { Button } from "@/components/ui/button"
import { useAppShell } from "@/lib/app-shell"
import { spineActionProps } from "@/lib/core/parity"
import { stepsUsingStructure } from "@/lib/structure-attachments"
import { activeFunctionId, functionsOnProject } from "@/lib/pipeline-functions"
import { useStore } from "@/lib/store"
import type { StructureModelId } from "@/lib/types"

export function StructureFunctionLinks({ modelId }: { modelId: StructureModelId }) {
  const { modules, project, setActiveFunction } = useStore()
  const { openPipeline } = useAppShell()
  const activeId = activeFunctionId(project)
  const links = stepsUsingStructure(modules, modelId)
  const extra = functionsOnProject(project).flatMap((fn) => {
    if (fn.id === activeId) return []
    return stepsUsingStructure(fn.modules, modelId).map((link) => ({
      ...link,
      functionId: fn.id,
      functionName: fn.name,
    }))
  })

  if (links.length === 0 && extra.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground">
        No function uses this type yet — pick it as a step input on Pipeline.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[10px] text-muted-foreground">Used by</span>
      {links.map((link) => (
        <Button
          key={`${link.moduleId}:${link.role}`}
          type="button"
          size="sm"
          variant="secondary"
          className="h-6 px-2 text-[10px]"
          onClick={() => openPipeline(link.moduleId)}
          {...spineActionProps("structure.open-function")}
        >
          {link.label}
        </Button>
      ))}
      {extra.map((link) => (
        <Button
          key={`${link.functionId}:${link.moduleId}`}
          type="button"
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[10px]"
          onClick={() => {
            setActiveFunction(link.functionId)
            openPipeline(link.moduleId)
          }}
          {...spineActionProps("structure.open-function")}
        >
          {link.functionName} · {link.label}
        </Button>
      ))}
    </div>
  )
}
