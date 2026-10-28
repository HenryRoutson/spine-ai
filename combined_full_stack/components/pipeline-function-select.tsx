"use client"

import { useRef, useState, type MouseEvent } from "react"
import { Check, ChevronDown, Pencil, Plus } from "lucide-react"
import { DeleteButton } from "@/components/delete-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    <div
      className="px-1.5 py-1"
      // AI : menu items steal focus / typeahead on pointer + keyboard — block both.
      onPointerDown={(e) => e.preventDefault()}
      onKeyDownCapture={(e) => e.stopPropagation()}
      onKeyUpCapture={(e) => e.stopPropagation()}
    >
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
        onClick={(e) => e.stopPropagation()}
        autoFocus
        aria-label="Function name"
        className="h-7 text-xs"
      />
    </div>
  )
}

// AI : same chrome as ProjectSelector — native <select> options ignore the dark theme.
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
  const [editingId, setEditingId] = useState<pipeline_function_id | null>(null)
  const canDelete = fns.length > 1

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <DropdownMenu onOpenChange={(open) => { if (!open) setEditingId(null) }}>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
          aria-label="Function in this project"
          title={`Function in this project: ${activeName}`}
          {...spineActionProps("pipeline.function-select")}
        >
          <span className="font-mono text-[10px] text-muted-foreground">Function</span>
          <span className="max-w-[180px] truncate font-medium">{activeName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
              functions
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {fns.map((fn) =>
              editingId === fn.id ? (
                <FunctionRenameInput
                  key={fn.id}
                  initialName={fn.name}
                  onCommit={(name) => {
                    renamePipelineFunction(fn.id, name)
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <DropdownMenuItem
                  key={fn.id}
                  onClick={() => setActiveFunction(fn.id)}
                  className="flex items-center justify-between gap-2 text-xs"
                  {...spineActionProps("pipeline.function-select")}
                >
                  <span className="min-w-0 truncate font-medium">{fn.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="h-6 w-6"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        setEditingId(fn.id)
                      }}
                      aria-label={`Rename ${fn.name}`}
                      title={`Rename ${fn.name}`}
                      spineId="pipeline.function-rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {canDelete ? (
                      <DeleteButton
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="h-6 w-6"
                        label={`Delete ${fn.name}`}
                        title={`Delete ${fn.name}`}
                        spineId="pipeline.function-delete"
                        onPointerDown={(e: MouseEvent) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation()
                          e.preventDefault()
                          deletePipelineFunction(fn.id)
                        }}
                      />
                    ) : null}
                    {fn.id === active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                  </div>
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuGroup>
          {allowAdd ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => addPipelineFunction()}
                className="gap-1.5 text-xs text-primary"
                {...spineActionProps("pipeline.function-add")}
              >
                <Plus className="h-3.5 w-3.5" />
                Add function
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {allowAdd ? (
        <Button
          type="button"
          variant="secondary"
          size="xs"
          className="h-[30px] gap-1.5 px-2.5 text-xs text-primary"
          onClick={() => addPipelineFunction()}
          title="Add a function that shares these structures"
          spineId="pipeline.function-add"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add function</span>
        </Button>
      ) : null}
    </div>
  )
}
