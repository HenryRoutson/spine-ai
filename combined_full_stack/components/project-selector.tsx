"use client"

import { useRef, useState } from "react"
import { Check, ChevronDown, LayoutGrid, Loader2, Pencil, Plus } from "lucide-react"
import { AnimatedRemovalItem } from "@/components/animated-removal-item"
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
import { navigateToProjectPicker } from "@/lib/app-mode-nav"
import { warmProjectPrefetches } from "@/lib/project-state-cache"
import { useAnimatedRemoval } from "@/lib/use-animated-removal"
import { useStore } from "@/lib/store"
import type { Project } from "@/lib/types"
import { cn } from "@/lib/utils"

function ProjectRenameInput({
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
        className="h-7 text-xs"
      />
    </div>
  )
}

export function ProjectSelector({ embed = false }: { embed?: boolean }) {
  const { projects, project, setActiveProjectId, prefetchProject, addProject, renameProject, deleteProject } =
    useStore()
  const [editing, setEditing] = useState<{ id: string; initialName: string } | null>(null)
  const [addingProject, setAddingProject] = useState(false)
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<Project>()
  const displayProjects = mergeWithGhosts(projects)

  function startRename(id: string, name: string) {
    setEditing({ id, initialName: name })
  }

  function commitRename(id: string, name: string) {
    renameProject(id, name)
    setEditing(null)
  }

  async function handleAddProject() {
    setAddingProject(true)
    try {
      await addProject()
    } finally {
      setAddingProject(false)
    }
  }

  function handleAllProjects() {
    navigateToProjectPicker()
  }

  function warmAllProjects() {
    warmProjectPrefetches(
      projects.map((p) => p.id),
      prefetchProject,
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) warmAllProjects()
        }}
      >
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs transition-colors hover:bg-accent">
          <span className="font-mono text-[10px] text-muted-foreground">Project</span>
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="max-w-[180px] truncate font-medium">{project.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
            projects
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {displayProjects.map((p) =>
            editing?.id === p.id ? (
              <ProjectRenameInput
                key={p.id}
                initialName={editing.initialName}
                onCommit={(name) => commitRename(p.id, name)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <AnimatedRemovalItem
                key={p.id}
                itemId={p.id}
                isExiting={isExiting(p.id)}
                as="div"
                className={cn(isDeleting(p.id) && "opacity-60")}
              >
                <DropdownMenuItem
                  onMouseEnter={() => prefetchProject(p.id)}
                  onFocus={() => prefetchProject(p.id)}
                  onClick={() => setActiveProjectId(p.id)}
                  className="group flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {p.kind}
                      {p.createdAt != null
                        ? ` · ${new Date(p.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                        : ""}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {!embed && (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            startRename(p.id, p.name)
                          }}
                          aria-label={`Rename ${p.name}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <DeleteButton
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          deleting={isDeleting(p.id)}
                          label={`Delete ${p.name}`}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            e.preventDefault()
                            void runDelete(p, projects, () => deleteProject(p.id))
                          }}
                        />
                      </>
                    )}
                    {p.id === project.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </DropdownMenuItem>
              </AnimatedRemovalItem>
            ),
          )}
        </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {!embed ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="h-[30px] gap-1.5 px-2.5 text-xs"
            onClick={handleAllProjects}
            title="Browse all projects"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">All projects…</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="h-[30px] gap-1.5 px-2.5 text-xs text-primary"
            onClick={() => void handleAddProject()}
            disabled={addingProject}
            aria-busy={addingProject}
            title="Create a new project"
          >
            {addingProject ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">New project</span>
          </Button>
        </>
      ) : null}
    </div>
  )
}
