"use client"

import { useState } from "react"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { MediaPlayer } from "@/components/media-player"
import { parseOutputJson, resolveViewer, storyboardFromValue, type ResolvedView } from "@/lib/data-view"
import { useDocFetchScope } from "@/lib/use-doc-fetch-scope"
import { cn } from "@/lib/utils"
import type { JsonViewerHumanViewId } from "@/lib/json-viewer"
import type { StructureModel } from "@/lib/types"

function PlayableMedia({ view, overlay }: { view: ResolvedView; overlay?: { title?: string; lowerThird?: string } }) {
  const video = view.viewerId === "video"
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <MediaPlayer view={view} className="flex min-h-0 flex-1 items-center justify-center bg-black/80 p-2" />
      {video && overlay?.title ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded bg-black/70 px-3 py-1 font-sans text-sm font-semibold tracking-wide text-white">
            {overlay.title}
          </span>
        </div>
      ) : null}
      {video && overlay?.lowerThird ? (
        <div className="pointer-events-none absolute inset-x-6 bottom-10">
          <span className="inline-block rounded bg-black/75 px-3 py-1.5 font-sans text-xs text-white">
            {overlay.lowerThird}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export function DataViewPanel({
  json,
  models,
  outStructureId,
  className,
  defaultView,
  lockedView,
  onFullscreen,
  simple = false,
}: {
  json: string
  models?: StructureModel[]
  outStructureId?: string
  className?: string
  defaultView?: JsonViewerHumanViewId
  lockedView?: JsonViewerHumanViewId
  onFullscreen?: () => void
  simple?: boolean
}) {
  const value = parseOutputJson(json)
  const view = resolveViewer({ value, models, outStructureId })
  const board = storyboardFromValue(value)
  const { docFileUrl } = useDocFetchScope()
  const media =
    view.viewerId === "audio" || view.viewerId === "video" || view.viewerId === "image" || !!board
  const [tab, setTab] = useState<"play" | "json">(media ? "play" : "json")

  if (!media) {
    return (
      <JsonPreviewPanel
        json={json}
        models={models}
        defaultView={defaultView}
        lockedView={lockedView}
        className={className}
        simple={simple}
        onFullscreen={onFullscreen}
      />
    )
  }

  const fileHref = view.docId ? docFileUrl(view.docId) : view.url
  const overlay = board ? { title: board.title, lowerThird: board.lowerThird } : undefined

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex items-center justify-between border-b border-border bg-secondary/20 px-3 py-1.5">
        <div className="flex rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setTab("play")}
            className={cn(
              "rounded px-2 py-0.5 font-mono text-[10px]",
              tab === "play" ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            play
          </button>
          <button
            type="button"
            onClick={() => setTab("json")}
            className={cn(
              "rounded px-2 py-0.5 font-mono text-[10px]",
              tab === "json" ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            json
          </button>
        </div>
        {fileHref ? (
          <a
            href={fileHref}
            download={view.filename}
            className="font-mono text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            {view.filename ?? "download"}
          </a>
        ) : null}
      </div>
      {tab === "play" ? (
        board && board.items.length > 1 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
            {overlay?.title ? (
              <p className="px-1 font-sans text-sm font-semibold">{overlay.title}</p>
            ) : null}
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
              {board.items
                .filter((item) => item.viewerId === "image")
                .map((item, i) => (
                  <div key={`${item.docId ?? item.url ?? i}-still`} className="min-h-32 overflow-hidden rounded-md border border-border">
                    <MediaPlayer view={item} className="flex h-full items-center justify-center bg-black/80 p-1" />
                  </div>
                ))}
            </div>
            {board.items
              .filter((item) => item.viewerId === "video")
              .map((item, i) => (
                <div key={`${item.docId ?? item.url ?? i}-clip`} className="min-h-48 flex-1 overflow-hidden rounded-md border border-border">
                  <PlayableMedia view={item} overlay={overlay} />
                </div>
              ))}
          </div>
        ) : (
          <PlayableMedia view={board?.items[0] ?? view} overlay={overlay} />
        )
      ) : (
        <JsonPreviewPanel
          json={json}
          models={models}
          defaultView={defaultView}
          lockedView={lockedView}
          className="min-h-0 flex-1"
          simple={simple}
          onFullscreen={onFullscreen}
        />
      )}
    </div>
  )
}
