"use client"

import { useEffect } from "react"
import { SharedRunViewer } from "@/components/shared-run-viewer"
import type { EmbedOptions } from "@/lib/shared-link-types"
// AI : TODO (media-view-A-share) — embed is the same run UI; media/custom views must work without builder chrome.

export function EmbedRunViewer({
  linkId,
  embedOptions,
  embedSessionToken,
}: {
  linkId: string
  embedOptions?: EmbedOptions
  embedSessionToken: string
}) {
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

  return <SharedRunViewer linkId={linkId} variant="embed" embedSessionToken={embedSessionToken} />
}
