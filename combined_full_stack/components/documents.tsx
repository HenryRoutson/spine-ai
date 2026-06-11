"use client"

import { useRef, useState } from "react"
import { useStore } from "@/lib/store"
import { useDocViewer } from "@/lib/doc-viewer"
import { WindowHeader } from "@/components/window-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
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
} from "lucide-react"
import type { DocLabel, InputType } from "@/lib/types"

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
  const { docs, addDoc } = useStore()
  const { open } = useDocViewer()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<DocLabel | "all">("all")
  const [dragOver, setDragOver] = useState(false)
  const [lastDedup, setLastDedup] = useState<string | null>(null)

  // AI : de-mocked — files go through POST /api/docs (server hashes + parses PDFs);
  // AI : dedup when the returned content hash already exists in the store.
  async function ingest(files: FileList | null, label: DocLabel) {
    if (!files) return
    for (const f of Array.from(files)) {
      try {
        const doc = await addDoc(f, label)
        if (docs.some((d) => d.id === doc.id)) {
          setLastDedup(doc.name)
          setTimeout(() => setLastDedup(null), 4000)
        }
      } catch (e) {
        setLastDedup(null)
        console.error(e)
      }
    }
  }

  const filtered = docs.filter((d) => {
    if (filter !== "all" && d.label !== filter) return false
    if (query.trim() && !d.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const totalKb = docs.reduce((a, d) => a + d.sizeKb, 0)

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="06 / Documents"
        title="Document Store"
        description="Content-addressed storage. Identical uploads dedupe to one hash so you never pay to process the same file twice."
      />

      <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
        <Stat label="Documents" value={String(docs.length)} />
        <Stat label="Total size" value={`${(totalKb / 1024).toFixed(1)} MB`} />
        <Stat label="Unique hashes" value={String(new Set(docs.map((d) => d.id)).size)} />
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
        {(["all", "inference", "training"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className={cn("h-8 capitalize", filter !== f && "bg-transparent")}
            onClick={() => setFilter(f)}
          >
            {f}
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
            ingest(e.dataTransfer.files, "inference")
          }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40",
          )}
        >
          <UploadCloud className={cn("h-5 w-5", dragOver ? "text-primary" : "text-muted-foreground")} />
          <p className="text-xs font-medium">Drop files to add to the store</p>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => ingest(e.target.files, "inference")} />
        </div>
        {lastDedup && (
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-chart-3">
            <Hash className="h-3 w-3" /> {lastDedup} already exists — deduped to the same hash, no reprocessing.
          </p>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="divide-y divide-border p-2">
          {filtered.map((doc) => {
            const Icon = TYPE_ICON[doc.type]
            return (
              <li
                key={doc.id + doc.name}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-accent"
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
                        doc.label === "training" ? "border-chart-2/40 text-chart-2" : "border-primary/40 text-primary",
                      )}
                    >
                      {doc.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Hash className="h-2.5 w-2.5" />
                      {doc.id}
                    </span>
                    <span>{doc.sizeKb} KB</span>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => open({ docId: doc.id, start: 0, end: 0 })}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                </Button>
              </li>
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
