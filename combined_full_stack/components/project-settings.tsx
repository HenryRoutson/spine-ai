"use client"

import { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { timeAgo } from "@/lib/time-ago"

export function ProjectSettings() {
  const { project, deleteProject } = useStore()
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameMatches = confirmName.trim() === project.name
  const canDelete = nameMatches && !project.teamReadOnly && !deleting

  async function handleDelete() {
    if (!canDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteProject(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project")
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <section className="mb-6 rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">General</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Overview for this pipeline workspace.</p>
          </div>
          <dl className="divide-y divide-border px-4 py-1 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{project.name}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <dt className="text-muted-foreground">Kind</dt>
              <dd className="font-mono text-xs">{project.kind}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <dt className="text-muted-foreground">Steps</dt>
              <dd className="font-mono text-xs">{project.modules.length}</dd>
            </div>
            {project.createdAt != null ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-mono text-xs">
                  {new Date(project.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {" · "}
                  {timeAgo(project.createdAt)}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-lg border border-destructive/40 bg-card">
          <div className="border-b border-destructive/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Permanently delete this project, its pipeline, documents, and run history. This cannot be undone.
            </p>
          </div>
          <div className="space-y-4 px-4 py-4">
            {project.teamReadOnly ? (
              <p className="text-xs text-muted-foreground">
                This project is read-only — only the owner can delete it.
              </p>
            ) : (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    Type <span className="font-medium text-foreground">{project.name}</span> to confirm
                  </span>
                  <Input
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={project.name}
                    autoComplete="off"
                    spellCheck={false}
                    className="max-w-md"
                  />
                </label>
                {error ? (
                  <p className="text-xs text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!canDelete}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Delete this project
                </Button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
