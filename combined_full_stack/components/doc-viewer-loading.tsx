"use client"

import { Loader2 } from "lucide-react"

export function DocViewerLoading() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="font-mono text-[11px]">loading source…</span>
    </div>
  )
}
