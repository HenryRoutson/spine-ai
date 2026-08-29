"use client"

import { useRef, useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { DeleteButton } from "@/components/delete-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { spineActionProps } from "@/lib/core/parity"
import { useStore } from "@/lib/store"
import {
  UNNAMED_FUNCTION_NAME,
  activeFunctionId,
  functionsOnProject,
} from "@/lib/pipeline-functions"
import type { pipeline_function_id } from "@/lib/types"
import { cn } from "@/lib/utils"

function FunctionRenameInput({
  initialName,
  onCommit,
  onCancel,
}: {
  initialName: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const valueRef = useRef(initialName)
  const skipBlurCommit = useRef(false)

  return (
    <Input
      defaultValue={initialName}
      onChange={(e) => {
        valueRef.current = e.target.value
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          skipBlurCommit.current = true
          onCommit(valueRef.current)
        }
        if (e.key === "Escape") {
          skipBlurCommit.current = true
          onCancel()
        }
      }}
      onBlur={() => {
        if (skipBlurCommit.current) {
          skipBlurCommit.current = false
          return
        }
        onCommit(valueRef.current)
      }}
      autoFocus
      aria-label="Function name"
      className="h-7 max-w-[12rem] font-mono text-[11px]"
    />
  )
}

// AI : project-level pipeline switch — structures stay shared; Hide developer tools hides Add.
export function PipelineFunctionSelect({
  className,
  allowAdd = true,
}: {
  className?: string
  allowAdd?: boolean
} = {}) {
  const {
    project,
    setActiveFunction,
    addPipelineFunction,
    renamePipelineFunction,
    deletePipelineFunction,
  } = useStore()
  const fns = functionsOnProject(project)
  const active = activeFunctionId(project)
  const activeName = fns.find((fn) => fn.id === active)?.name ?? UNNAMED_FUNCTION_NAME
  const [editing, setEditing] = useState(false)
  const canDelete = fns.length > 1

  function commitRename(name: string) {
    renamePipelineFunction(active, name)
    setEditing(false)
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
        Function
      </span>
      {editing ? (
        <FunctionRenameInput
          initialName={activeName}
          onCommit={commitRename}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <select
          className="h-7 max-w-[12rem] rounded-md border border-border bg-background px-1.5 font-mono text-[11px]"
          value={active}
          onChange={(e) => setActiveFunction(e.target.value as pipeline_function_id)}
          aria-label="Function in this project"
          title={`Function in this project: ${activeName}`}
          {...spineActionProps("pipeline.function-select")}
        >
          {fns.map((fn) => (
            <option key={fn.id} value={fn.id}>
              {fn.name}
            </option>
          ))}
        </select>
      )}
      {!editing ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          title={`Rename ${activeName}`}
          aria-label={`Rename ${activeName}`}
          {...spineActionProps("pipeline.function-rename")}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      ) : null}
      {canDelete && !editing ? (
        <DeleteButton
          type="button"
          size="icon-sm"
          variant="ghost"
          label={`Delete ${activeName}`}
          title={`Delete ${activeName}`}
          {...spineActionProps("pipeline.function-delete")}
          onClick={() => deletePipelineFunction(active)}
        />
      ) : null}
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
