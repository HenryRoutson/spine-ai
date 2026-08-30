"use client"
// AI : bolt.diy workbench file tree — select / delete reactFiles.

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, FileCode2, Folder, FolderOpen, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { spineActionProps } from "@/lib/core/parity"
import { buildHostedSiteFileTree, visibleHostedSiteFileTree } from "@/lib/hosted-site-file-tree"
import { canDeleteHostedSiteReactPath } from "@/lib/hosted-site-react"
import type { HostedSiteReactFile } from "@/lib/shared-link-types"

export function HostedSiteFileTree({
  files,
  selectedPath,
  onSelect,
  onAdd,
  onDelete,
}: {
  files: HostedSiteReactFile[]
  selectedPath: string
  onSelect: (path: string) => void
  onAdd: () => void
  onDelete: (path: string) => void
}) {
  const tree = useMemo(() => buildHostedSiteFileTree(files.map((f) => f.path)), [files])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const visible = useMemo(() => visibleHostedSiteFileTree(tree, collapsed), [tree, collapsed])

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-muted/20" {...spineActionProps("share.site-file-tree")}>
      <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-1">
        <p className="text-[10px] font-medium text-muted-foreground">Files</p>
        <button
          type="button"
          className="inline-flex h-6 items-center gap-0.5 rounded px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={onAdd}
          {...spineActionProps("share.site-file-add")}
        >
          <Plus className="h-3 w-3" />
          File
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto py-1">
        {visible.map((node) => {
          const selected = node.kind === "file" && node.path === selectedPath
          const open = node.kind === "folder" && !collapsed.has(node.path)
          return (
            <li key={`${node.kind}:${node.path}`}>
              <div
                className={cn(
                  "group flex items-center gap-0.5 pr-1 text-[11px]",
                  selected ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                style={{ paddingLeft: `${6 + node.depth * 10}px` }}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left"
                  onClick={() => {
                    if (node.kind === "folder") {
                      setCollapsed((prev) => {
                        const next = new Set(prev)
                        if (next.has(node.path)) next.delete(node.path)
                        else next.add(node.path)
                        return next
                      })
                      return
                    }
                    onSelect(node.path)
                  }}
                >
                  {node.kind === "folder" ? (
                    open ? (
                      <FolderOpen className="h-3 w-3 shrink-0" />
                    ) : (
                      <Folder className="h-3 w-3 shrink-0" />
                    )
                  ) : (
                    <FileCode2 className="h-3 w-3 shrink-0" />
                  )}
                  {node.kind === "folder" ? (
                    open ? (
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                    )
                  ) : null}
                  <span className="truncate font-mono">{node.name}</span>
                </button>
                {node.kind === "file" && canDeleteHostedSiteReactPath(node.path) ? (
                  <button
                    type="button"
                    className="hidden h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive group-hover:flex"
                    aria-label={`Delete ${node.path}`}
                    onClick={() => onDelete(node.path)}
                    {...spineActionProps("share.site-file-delete")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
