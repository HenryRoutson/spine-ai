"use client"

// AI: embeds json-viewer.html in an iframe in ?embed mode and sends JSON via postMessage.
// AI: re-sends whenever the json prop changes so the viewer always reflects current data.

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  readJsonViewerDefaultView,
  readJsonViewerSyntaxTheme,
} from "@/lib/json-viewer"

interface JsonViewerEmbedProps {
  json: string
  className?: string
}

export function JsonViewerEmbed({ json, className }: JsonViewerEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function post(payload: object) {
    iframeRef.current?.contentWindow?.postMessage(payload, "*")
  }

  function sendLoad() {
    post({
      type: "json-viewer:load",
      json,
      defaultView: readJsonViewerDefaultView(),
      syntaxTheme: readJsonViewerSyntaxTheme(),
    })
  }

  useEffect(() => {
    sendLoad()
  }, [json]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onSettings = () => {
      post({
        type: "json-viewer:settings",
        defaultView: readJsonViewerDefaultView(),
        syntaxTheme: readJsonViewerSyntaxTheme(),
      })
    }
    window.addEventListener(JSON_VIEWER_SETTINGS_CHANGED_EVENT, onSettings)
    return () => window.removeEventListener(JSON_VIEWER_SETTINGS_CHANGED_EVENT, onSettings)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      src="/json-viewer.html?embed"
      className={cn("w-full border-0 bg-background", className)}
      title="JSON Viewer"
      onLoad={sendLoad}
    />
  )
}
