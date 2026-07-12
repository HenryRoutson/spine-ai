"use client"

// AI : embeds json-viewer.html (?embed) and sends JSON via postMessage — shared by app + landing.

import { useEffect, useRef } from "react"
import type { JsonViewerHumanViewId, JsonViewerSyntaxThemeId } from "./types"
import { DEFAULT_JSON_VIEWER_SYNTAX_THEME } from "./types"

export type JsonViewerEmbedProps = {
  json: string
  className?: string
  // AI : per-embed override — landing / inference force table without changing global prefs
  defaultView?: JsonViewerHumanViewId
  syntaxTheme?: JsonViewerSyntaxThemeId
  // AI : optional — app wires localStorage prefs; landing can omit
  onSettingsEventName?: string
  readDefaultView?: () => JsonViewerHumanViewId
  readSyntaxTheme?: () => JsonViewerSyntaxThemeId
}

export function JsonViewerEmbed({
  json,
  className,
  defaultView,
  syntaxTheme,
  onSettingsEventName,
  readDefaultView,
  readSyntaxTheme,
}: JsonViewerEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // AI : same-origin only — avoids leaking JSON to arbitrary embedders via postMessage("*").
  function post(payload: object) {
    const target = iframeRef.current?.contentWindow
    if (!target) return
    target.postMessage(payload, window.location.origin)
  }

  const resolvedDefaultView = defaultView ?? readDefaultView?.() ?? "tree"
  const resolvedSyntaxTheme =
    syntaxTheme ?? readSyntaxTheme?.() ?? DEFAULT_JSON_VIEWER_SYNTAX_THEME

  function sendLoad() {
    post({
      type: "json-viewer:load",
      json,
      defaultView: resolvedDefaultView,
      syntaxTheme: resolvedSyntaxTheme,
    })
  }

  useEffect(() => {
    sendLoad()
  }, [json, resolvedDefaultView, resolvedSyntaxTheme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onSettingsEventName) return
    const onSettings = () => {
      post({
        type: "json-viewer:settings",
        defaultView: defaultView ?? readDefaultView?.() ?? "tree",
        syntaxTheme: syntaxTheme ?? readSyntaxTheme?.() ?? DEFAULT_JSON_VIEWER_SYNTAX_THEME,
      })
    }
    window.addEventListener(onSettingsEventName, onSettings)
    return () => window.removeEventListener(onSettingsEventName, onSettings)
  }, [onSettingsEventName, defaultView, syntaxTheme, readDefaultView, readSyntaxTheme])

  return (
    <iframe
      ref={iframeRef}
      src="/json-viewer.html?embed"
      className={className ?? "w-full border-0 bg-background"}
      title="JSON Viewer"
      onLoad={sendLoad}
    />
  )
}
