"use client"

import { useRef, useState, type ReactNode } from "react"
import { Loader2, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FileDropZoneProps = {
  onFiles: (files: File[]) => void
  disabled?: boolean
  uploading?: boolean
  accept?: string
  multiple?: boolean
  /** AI : compact = composer strip; default = Documents / Vibe inputs. */
  compact?: boolean
  className?: string
  label?: string
  browseLabel?: string
  children?: ReactNode
}

// AI : dotted outline — drag/drop primary, browse secondary (agent / Vibe / Documents).
export function FileDropZone({
  onFiles,
  disabled = false,
  uploading = false,
  accept,
  multiple = true,
  compact = false,
  className,
  label = "Drag & drop files here",
  browseLabel = "Browse files",
  children,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const blocked = disabled || uploading

  function takeFiles(list: FileList | null) {
    if (!list?.length || blocked) return
    onFiles(Array.from(list))
  }

  return (
    <div
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-label={label}
      aria-disabled={blocked}
      onKeyDown={(e) => {
        if (blocked) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!blocked) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        takeFiles(e.dataTransfer.files)
      }}
      onClick={() => {
        if (!blocked) inputRef.current?.click()
      }}
      className={cn(
        "flex flex-col items-center justify-center border-2 border-dotted text-center transition-colors",
        compact ? "gap-1 rounded-md px-3 py-2.5" : "gap-1.5 rounded-lg px-4 py-5",
        blocked && "pointer-events-none opacity-60",
        dragOver
          ? "border-primary bg-primary/5 text-primary"
          : "border-muted-foreground/35 bg-muted/10 text-muted-foreground hover:border-muted-foreground/55 hover:bg-muted/20",
        className,
      )}
    >
      {uploading ? (
        <Loader2 className={cn("animate-spin", compact ? "h-4 w-4" : "h-6 w-6")} />
      ) : (
        <UploadCloud className={cn(compact ? "h-4 w-4" : "h-6 w-6")} />
      )}
      <p className={cn("font-medium", compact ? "text-[11px]" : "text-xs")}>
        {uploading ? "Uploading…" : label}
      </p>
      {!uploading ? (
        <>
          <p className={cn("text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>or</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "font-mono",
              compact ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-[11px]",
              dragOver && "border-primary/50 text-primary",
            )}
            disabled={blocked}
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
            spineId="documents.upload"
          >
            {browseLabel}
          </Button>
        </>
      ) : null}
      {children}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        disabled={blocked}
        onChange={(e) => {
          takeFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </div>
  )
}
