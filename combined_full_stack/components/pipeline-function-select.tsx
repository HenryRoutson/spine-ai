"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { spineActionProps } from "@/lib/core/parity"
import { useStore } from "@/lib/store"
import { activeFunctionId, functionsOnProject } from "@/lib/pipeline-functions"
import type { pipeline_function_id } from "@/lib/types"
import { cn } from "@/lib/utils"

// AI : which function (pipeline) this project is editing / running — types stay shared.
export function PipelineFunctionSelect({ className }: { className?: string } = {}) {
  const { project, setActiveFunction, addPipelineFunction } = useStore()
  const fns = functionsOnProject(project)
  const active = activeFunctionId(project)

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <select
        className="h-7 max-w-[11rem] rounded-md border border-border bg-background px-1.5 font-mono text-[11px]"
        value={active}
        onChange={(e) => setActiveFunction(e.target.value as pipeline_function_id)}
        title="Function in this project"
        {...spineActionProps("pipeline.function-select")}
      >
        {fns.map((fn) => (
          <option key={fn.id} value={fn.id}>
            {fn.name}
          </option>
        ))}
      </select>
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
    </div>
  )
}
