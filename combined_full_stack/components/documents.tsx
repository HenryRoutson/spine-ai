"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { useDocViewer } from "@/lib/doc-viewer"
import { useAppShell } from "@/lib/app-shell"
import { docLabelDisplay, docsForProject } from "@/lib/project-docs"
import { DocProjectPicker } from "@/components/doc-project-picker"
import { WindowHeader } from "@/components/window-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { confidentialUploadWarning } from "@/lib/confidential-upload"
import { timeAgo } from "@/lib/time-ago"
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileJson,
  Globe,
  ImageIcon,
  Hash,
  Eye,
  Search,
  TriangleAlert,
  SquareCheck,
} from "lucide-react"
import { isTestingFileName } from "@/lib/testing-files"
import { AnimatedRemovalItem } from "@/components/animated-removal-item"
import { DeleteButton } from "@/components/delete-button"
import { useAnimatedRemoval } from "@/lib/use-animated-removal"
import { DocLabel } from "@/lib/types"
import type { DocRef, InputType } from "@/lib/types"

const TYPE_ICON: Record<InputType, typeof FileText> = {
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  json: FileJson,
  text: FileText,
  web: Globe,
  image: ImageIcon,
}

export function Documents() {
  const { docs, addDoc, removeDoc, project, projects } = useStore()
  const { open, close, target } = useDocViewer()
  const { focusDocId, clearFocusDoc } = useAppShell()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<DocLabel | "all">("all")
  const [dragOver, setDragOver] = useState(false)
  const [lastDedup, setLastDedup] = useState<string | null>(null)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null)
  const { isDeleting, isExiting, runDelete, mergeWithGhosts } = useAnimatedRemoval<DocRef>()

  // AI : scroll to and highlight a doc when opened from Inference / Logging links.
  useEffect(() => {
    if (!focusDocId) return
    setFilter("all")
    setQuery("")
    const t = window.setTimeout(() => {
      document.getElementById(`doc-row-${focusDocId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 50)
    return () => window.clearTimeout(t)
  }, [focusDocId])

  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])

  // AI : de-mocked — files go through POST /api/docs (server hashes + parses PDFs);
  // AI : dedup when the returned content hash already exists in the store.
  async function ingest(files: FileList | null, label: DocLabel) {
    if (!files) return
    for (const f of Array.from(files)) {
      const blocked = confidentialUploadWarning(f.name)
      if (blocked) {
        setUploadWarning(blocked)
        setTimeout(() => setUploadWarning(null), 6000)
        continue
      }
      try {
        const doc = await addDoc(f, label, project.id)
        if (projectDocs.some((d) => d.id === doc.id)) {
          setLastDedup(doc.name)
          setTimeout(() => setLastDedup(null), 4000)
        }
      } catch (e) {
        setLastDedup(null)
        const msg = e instanceof Error ? e.message : null
        if (msg && confidentialUploadWarning(f.name)) {
          setUploadWarning(msg)
          setTimeout(() => setUploadWarning(null), 6000)
        } else {
          console.error(e)
        }
      }
    }
  }

  const filtered = projectDocs.filter((d) => {
    if (filter !== "all" && d.label !== filter) return false
    if (query.trim() && !d.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const totalKb = projectDocs.reduce((a, d) => a + d.sizeKb, 0)

  async function handleDelete(doc: DocRef, e: React.MouseEvent) {
    e.stopPropagation()
    await runDelete(doc, filtered, async () => {
      await removeDoc(doc.id, project.id)
      if (target?.docId === doc.id) close()
    })
  }

  const displayDocs = mergeWithGhosts(filtered)

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="06 / Documents"
        title="Document Store"
        description={`Content-addressed storage for ${project.name}. Uploads default to this pipeline — share to others from each row.`}
      />

      <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
        <Stat label="Documents" value={String(projectDocs.length)} />
        <Stat label="Total size" value={`${(totalKb / 1024).toFixed(1)} MB`} />
        <Stat label="Unique hashes" value={String(new Set(projectDocs.map((d) => d.id)).size)} />
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="h-8 pl-8 font-mono text-xs"
          />
        </div>
        {/* AI : "testing" docs are stored under the legacy Training DocLabel; re-click to clear the filter. */}
        {[DocLabel.Inference, DocLabel.Training].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className={cn("h-8 capitalize", filter !== f && "bg-transparent")}
            onClick={() => setFilter(filter === f ? "all" : f)}
          >
            {docLabelDisplay(f)}
          </Button>
        ))}
      </div>

      <div className="px-4 pt-3">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            ingest(e.dataTransfer.files, DocLabel.Inference)
          }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40",
          )}
        >
          <UploadCloud className={cn("h-5 w-5", dragOver ? "text-primary" : "text-muted-foreground")} />
          <p className="text-xs font-medium">Drop files to add to the store</p>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => ingest(e.target.files, DocLabel.Inference)} />
        </div>
        {uploadWarning && (
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-destructive">
            <TriangleAlert className="h-3 w-3 shrink-0" /> {uploadWarning}
          </p>
        )}
        {lastDedup && (
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-chart-3">
            <Hash className="h-3 w-3" /> {lastDedup} already exists — deduped to the same hash, no reprocessing.
          </p>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="divide-y divide-border p-2">
          {displayDocs.map((doc) => {
            // AI : *_testing.json files carry a checkbox mark — spec § Testing.
            const isTest = isTestingFileName(doc.name)
            const Icon = isTest ? SquareCheck : TYPE_ICON[doc.type]
            const deleting = isDeleting(doc.id)
            const exiting = isExiting(doc.id)
            return (
              <AnimatedRemovalItem
                key={doc.id + doc.name}
                itemId={doc.id}
                isExiting={exiting}
                id={`doc-row-${doc.id}`}
                onClick={() => focusDocId === doc.id && clearFocusDoc()}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-accent",
                  focusDocId === doc.id && "bg-primary/10 ring-1 ring-primary/30",
                  deleting && "opacity-60",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">{doc.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-[9px] capitalize",
                        doc.label === DocLabel.Training ? "border-chart-2/40 text-chart-2" : "border-primary/40 text-primary",
                      )}
                    >
                      {docLabelDisplay(doc.label)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Hash className="h-2.5 w-2.5" />
                      {doc.id}
                    </span>
                    <span>{doc.sizeKb} KB</span>
                    <span>
                      {new Date(doc.uploadedAt).toLocaleString()} · {timeAgo(doc.uploadedAt)}
                    </span>
                  </p>
                </div>
                {projects.length > 1 && (
                  <DocProjectPicker doc={doc} activeProjectId={project.id} />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    open({ docId: doc.id, start: 0, end: 0 })
                  }}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                </Button>
                <DeleteButton
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  deleting={deleting}
                  label={`Delete ${doc.name}`}
                  onClick={(e: React.MouseEvent) => void handleDelete(doc, e)}
                />
              </AnimatedRemovalItem>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-2.5">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-sm">{value}</p>
    </div>
  )
}
