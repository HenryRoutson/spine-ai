"use client"

import type { ReactNode } from "react"
import { Copy, FolderKanban, Globe, Store, Users } from "lucide-react"
import {
  LIBRARY_SHELVES,
  type library_entity,
  type library_shelf_id,
} from "@/lib/library-shelf"
import { cn } from "@/lib/utils"

const SHELF_ICON: Record<library_shelf_id, typeof FolderKanban> = {
  yours: FolderKanban,
  shared: Users,
  marketplace: Store,
  templates: Copy,
}

export function LibraryShelf({
  entity,
  id,
  count,
  children,
  className,
}: {
  entity: library_entity
  id: library_shelf_id
  count?: number
  children: ReactNode
  className?: string
}) {
  const meta = LIBRARY_SHELVES.find((s) => s.id === id)!
  const Icon = id === "yours" && entity === "websites" ? Globe : SHELF_ICON[id]
  return (
    <section className={cn("mb-8", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">
          {id === "yours" ? (entity === "websites" ? "Your websites" : "Your pipelines") : meta.title}
        </h3>
        {count != null ? (
          <span className="font-mono text-[10px] text-muted-foreground">({count})</span>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{meta.hint(entity)}</p>
      {children}
    </section>
  )
}
