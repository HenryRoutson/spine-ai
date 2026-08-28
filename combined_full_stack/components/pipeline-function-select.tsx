"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { spineActionProps } from "@/lib/core/parity"
import { useStore } from "@/lib/store"
import { activeFunctionId, functionsOnProject } from "@/lib/pipeline-functions"
import type { pipeline_function_id } from "@/lib/types"
import { cn } from "@/lib/utils"

// AI : project-level pipeline switch — structures stay shared; Hide developer tools hides Add.
export function PipelineFunctionSelect({
  className,
  allowAdd = true,
}: {
  className?: string
  allowAdd?: boolean
} = {}) {
  const { project, setActiveFunction, addPipelineFunction } = useStore()
  const fns = functionsOnProject(project)
  const active = activeFunctionId(project)
  const activeName = fns.find((fn) => fn.id === active)?.name ?? "Main"

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
        Pipeline
      </span>
      <select
        className="h-7 max-w-[12rem] rounded-md border border-border bg-background px-1.5 font-mono text-[11px]"
        value={active}
        onChange={(e) => setActiveFunction(e.target.value as pipeline_function_id)}
        title={`Pipeline in this project: ${activeName}`}
        {...spineActionProps("pipeline.function-select")}
      >
        {fns.map((fn) => (
          <option key={fn.id} value={fn.id}>
            {fn.name}
          </option>
        ))}
      </select>
      {allowAdd ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[10px]"
          onClick={() => addPipelineFunction()}
          title="Add a function that shares these structures"
          {...spineActionProps("pipeline.function-add")}
        >
          <Plus className="mr-0.5 h-3 w-3" />
          Function
        </Button>
      ) : null}
    </div>
  )
}
