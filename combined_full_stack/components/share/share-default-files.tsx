"use client"

import { orderedInputModules } from "@/lib/inference-input"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"

export function ShareDefaultFiles({
  project,
  docs,
  defaultDocsByModule,
  simple = false,
}: {
  project: Project
  docs: DocRef[]
  defaultDocsByModule: Partial<Record<ModuleId, DocId[]>>
  simple?: boolean
}) {
  const inputModules = orderedInputModules(project.modules)
  const names = inputModules.flatMap((m) =>
    (defaultDocsByModule[m.id] ?? [])
      .map((id) => docs.find((d) => d.id === id)?.name)
      .filter((name): name is string => Boolean(name)),
  )

  if (simple) {
    return (
      <p className="text-xs text-muted-foreground">
        {names.length
          ? `They'll start with: ${names.join(", ")}`
          : "Pick files in Inference first so people have something to start with."}
      </p>
    )
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="mb-2 text-xs text-muted-foreground">Files used each time</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {inputModules.map((m) => {
          const ids = defaultDocsByModule[m.id] ?? []
          const fileNames = ids.map((id) => docs.find((d) => d.id === id)?.name).filter(Boolean)
          return (
            <li key={m.id}>
              <span className="text-foreground">{m.label}:</span>{" "}
              {fileNames.length ? fileNames.join(", ") : "none — assign inputs in Inference first"}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
