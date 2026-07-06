"use client"

import { orderedInputModules } from "@/lib/inference-input"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"

export function ShareDefaultFiles({
  project,
  docs,
  defaultDocsByModule,
}: {
  project: Project
  docs: DocRef[]
  defaultDocsByModule: Partial<Record<ModuleId, DocId[]>>
}) {
  const inputModules = orderedInputModules(project.modules)

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Default files
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {inputModules.map((m) => {
          const ids = defaultDocsByModule[m.id] ?? []
          const names = ids.map((id) => docs.find((d) => d.id === id)?.name).filter(Boolean)
          return (
            <li key={m.id}>
              <span className="text-foreground">{m.label}:</span>{" "}
              {names.length ? names.join(", ") : "none — assign inputs in Inference first"}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
