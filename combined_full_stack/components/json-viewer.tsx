"use client"

// AI: embeds json-viewer.html in an iframe in ?embed mode and sends JSON via postMessage.
// AI: re-sends whenever the json prop changes so the viewer always reflects current data.

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  readJsonViewerDefaultView,
  readJsonViewerSyntaxTheme,
  type JsonViewerHumanViewId,
} from "@/lib/json-viewer"

interface JsonViewerEmbedProps {
  json: string
  className?: string
  // AI : per-embed override — inference final output defaults to table without changing global prefs
  defaultView?: JsonViewerHumanViewId
}

export function JsonViewerEmbed({ json, className, defaultView }: JsonViewerEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // AI : same-origin only — avoids leaking JSON to arbitrary embedders via postMessage("*").
  function post(payload: object) {
    const target = iframeRef.current?.contentWindow
    if (!target) return
    target.postMessage(payload, window.location.origin)
  }

  const resolvedDefaultView = defaultView ?? readJsonViewerDefaultView()

  function sendLoad() {
    post({
      type: "json-viewer:load",
      json,
      defaultView: resolvedDefaultView,
      syntaxTheme: readJsonViewerSyntaxTheme(),
    })
  }

  useEffect(() => {
    sendLoad()
  }, [json, resolvedDefaultView]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onSettings = () => {
      post({
        type: "json-viewer:settings",
        defaultView: resolvedDefaultView,
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
