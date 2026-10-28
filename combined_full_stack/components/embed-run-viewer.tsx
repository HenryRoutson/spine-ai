"use client"

import { useCallback, useEffect } from "react"
import { SharedRunViewer } from "@/components/shared-run-viewer"
import type { EmbedOptions } from "@/lib/shared-link-types"
import type { SharedRunLifecycleEvent } from "@/lib/use-shared-inference-run"
// AI : DONE (media-view-A-share) — embed is the same run UI; DataViewPanel works without builder chrome.

function postEmbedRunEvent(linkId: string, event: SharedRunLifecycleEvent) {
  if (window.parent === window) return
  const type =
    event.type === "started"
      ? "spine-embed-run-started"
      : event.type === "finished"
        ? "spine-embed-run-finished"
        : "spine-embed-run-error"
  window.parent.postMessage(
    { type, linkId, ...(event.type === "error" ? { error: event.error } : {}) },
    "*",
  )
}

export function EmbedRunViewer({
  linkId,
  embedOptions,
  embedSessionToken,
}: {
  linkId: string
  embedOptions?: EmbedOptions
  embedSessionToken: string
}) {
  const onRunEvent = useCallback(
    (event: SharedRunLifecycleEvent) => {
      if (!embedOptions?.postMessageEvents) return
      postEmbedRunEvent(linkId, event)
    },
    [embedOptions?.postMessageEvents, linkId],
  )

  useEffect(() => {
    if (!embedOptions?.postMessageEvents) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "spine-embed-ping") return
      try {
        event.source?.postMessage({ type: "spine-embed-pong", linkId }, { targetOrigin: event.origin })
      } catch {
        // ignore
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [embedOptions?.postMessageEvents, linkId])

  return (
    <SharedRunViewer
      linkId={linkId}
      variant="embed"
      embedSessionToken={embedSessionToken}
      onRunEvent={onRunEvent}
    />
  )
}
