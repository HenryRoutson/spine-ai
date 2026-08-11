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
  // AI : parent hosts a larger viewer (PopupModal) — shows ⛶ next to JSON + latex detail
  onFullscreen?: () => void
}

export function JsonViewerEmbed({
  json,
  className,
  defaultView,
  syntaxTheme,
  onSettingsEventName,
  readDefaultView,
  readSyntaxTheme,
  onFullscreen,
}: JsonViewerEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const onFullscreenRef = useRef(onFullscreen)
  onFullscreenRef.current = onFullscreen

  // AI : same-origin only — avoids leaking JSON to arbitrary embedders via postMessage("*").
  function post(payload: object) {
    const target = iframeRef.current?.contentWindow
    if (!target) return
    target.postMessage(payload, window.location.origin)
  }

  const resolvedDefaultView = defaultView ?? readDefaultView?.() ?? "tree"
  const resolvedSyntaxTheme =
    syntaxTheme ?? readSyntaxTheme?.() ?? DEFAULT_JSON_VIEWER_SYNTAX_THEME
  const showFullscreen = !!onFullscreen

  function sendLoad() {
    post({
      type: "json-viewer:load",
      json,
      defaultView: resolvedDefaultView,
      syntaxTheme: resolvedSyntaxTheme,
      showFullscreen,
    })
  }

  useEffect(() => {
    sendLoad()
  }, [json, resolvedDefaultView, resolvedSyntaxTheme, showFullscreen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onSettingsEventName) return
    const onSettings = () => {
      post({
        type: "json-viewer:settings",
        defaultView: defaultView ?? readDefaultView?.() ?? "tree",
        syntaxTheme: syntaxTheme ?? readSyntaxTheme?.() ?? DEFAULT_JSON_VIEWER_SYNTAX_THEME,
        showFullscreen: !!onFullscreenRef.current,
      })
    }
    window.addEventListener(onSettingsEventName, onSettings)
    return () => window.removeEventListener(onSettingsEventName, onSettings)
  }, [onSettingsEventName, defaultView, syntaxTheme, readDefaultView, readSyntaxTheme])

  useEffect(() => {
    if (!onFullscreen) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.source !== iframeRef.current?.contentWindow) return
      if (!e.data || e.data.type !== "json-viewer:fullscreen") return
      onFullscreenRef.current?.()
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onFullscreen])

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
