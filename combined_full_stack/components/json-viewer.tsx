"use client"

// AI: embeds json-viewer.html in an iframe in ?embed mode and sends JSON via postMessage.
// AI: re-sends whenever the json prop changes so the viewer always reflects current data.

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface JsonViewerEmbedProps {
  json: string
  className?: string
}

export function JsonViewerEmbed({ json, className }: JsonViewerEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function send() {
    iframeRef.current?.contentWindow?.postMessage({ type: "json-viewer:load", json }, "*")
  }

  useEffect(() => {
    send()
  }, [json]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <iframe
      ref={iframeRef}
      src="/json-viewer.html?embed"
      className={cn("w-full border-0", className)}
      title="JSON Viewer"
      onLoad={send}
    />
  )
}
