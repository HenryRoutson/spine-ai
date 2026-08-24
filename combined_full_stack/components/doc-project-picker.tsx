"use client"

// AI : parity ids — documents.set-projects
import { useMemo, useState } from "react"
import { useStore } from "@/lib/store"
import { projectIdsForDoc } from "@/lib/project-docs"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { FolderKanban } from "lucide-react"
import type { DocRef, ProjectId } from "@/lib/types"

export function DocProjectPicker({
  doc,
  activeProjectId,
  className,
}: {
  doc: DocRef
  activeProjectId: ProjectId
  className?: string
}) {
  const { projects, setDocProjects } = useStore()
  const linkedIds = useMemo(() => projectIdsForDoc(projects, doc.name), [projects, doc.name])
  const [pending, setPending] = useState(false)

  async function toggle(projectId: ProjectId, checked: boolean) {
    const next = checked
      ? [...new Set([...linkedIds, projectId])]
      : linkedIds.filter((id) => id !== projectId)
    if (!next.length) return
    setPending(true)
    try {
      await setDocProjects(doc.id, next)
    } catch (err) {
      console.error(err)
    } finally {
      setPending(false)
    }
  }

  const label =
    linkedIds.length === 1
      ? projects.find((p) => p.id === linkedIds[0])?.name ?? "1 pipeline"
      : `${linkedIds.length} pipelines`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        data-spine-id="documents.set-projects"
        className={cn(
          "inline-flex h-7 max-w-[9rem] shrink-0 items-center gap-1 rounded-md px-2 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <FolderKanban className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="font-mono text-[10px] uppercase">Available in</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.map((p) => {
          const checked = linkedIds.includes(p.id)
          const onlyLink = checked && linkedIds.length === 1
          return (
            <DropdownMenuCheckboxItem
              key={p.id}
              checked={checked}
              disabled={pending || onlyLink}
              onCheckedChange={(next) => void toggle(p.id, next === true)}
              className="font-mono text-xs"
            >
              <span className={cn("truncate", p.id === activeProjectId && "font-medium")}>
                {p.name}
                {p.id === activeProjectId ? " (current)" : ""}
              </span>
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
