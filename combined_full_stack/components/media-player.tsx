"use client"

import { useDocFetchScope } from "@/lib/use-doc-fetch-scope"
import type { ResolvedView } from "@/lib/data-view"

export function MediaPlayer({
  view,
  className,
}: {
  view: ResolvedView
  className?: string
}) {
  const { docFileUrl } = useDocFetchScope()
  const src = view.docId ? docFileUrl(view.docId) : view.url
  if (!src) {
    return (
      <p className="px-4 py-6 font-mono text-[11px] text-muted-foreground">
        no playable url or stored file on this clip
      </p>
    )
  }
  if (view.viewerId === "audio") {
    return (
      <div className={className ?? "flex items-center justify-center p-6"}>
        <audio controls src={src} className="w-full max-w-xl" preload="metadata">
          <a href={src}>download audio</a>
        </audio>
      </div>
    )
  }
  if (view.viewerId === "image") {
    return (
      <div className={className ?? "flex min-h-0 flex-1 items-center justify-center bg-black/80 p-2"}>
        {/* AI : stored still — play in-app, not a download-only link */}
        <img src={src} alt={view.filename ?? view.title ?? "still"} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }
  return (
    <div className={className ?? "flex min-h-0 flex-1 items-center justify-center bg-black/80 p-2"}>
      <video controls src={src} className="max-h-full max-w-full" preload="metadata">
        <a href={src}>download video</a>
      </video>
    </div>
  )
}
