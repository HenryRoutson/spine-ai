"use client"

// AI : embeds json-viewer.html (?embed) and sends JSON via postMessage — shared by app + landing.

import { useEffect, useMemo, useRef } from "react"
import type {
  JsonViewerChromeColors,
  JsonViewerChromeTheme,
  JsonViewerHumanViewId,
  JsonViewerSyntaxThemeId,
} from "./types"
import {
  DEFAULT_JSON_VIEWER_HUMAN_VIEW,
  DEFAULT_JSON_VIEWER_SYNTAX_THEME,
  JSON_VIEWER_MESSAGE_FULLSCREEN,
  JSON_VIEWER_MESSAGE_LOAD,
  JSON_VIEWER_MESSAGE_SETTINGS,
} from "./types"

export type JsonViewerEmbedProps = {
  json: string
  className?: string
  // AI : per-embed override — landing / inference force table without changing global prefs
  defaultView?: JsonViewerHumanViewId
  // AI : hide other formats — table lock is spreadsheet-only
  lockedView?: JsonViewerHumanViewId
  syntaxTheme?: JsonViewerSyntaxThemeId
  // AI : optional — app wires localStorage prefs; landing can omit
  onSettingsEventName?: string
  readDefaultView?: () => JsonViewerHumanViewId
  readSyntaxTheme?: () => JsonViewerSyntaxThemeId
  // AI : parent hosts a larger viewer (PopupModal) — shows ⛶ next to JSON + latex detail
  onFullscreen?: () => void
  // AI : hosted {{run}} panels pass light/dark + brand colors into the iframe
  chromeTheme?: JsonViewerChromeTheme
  chromeColors?: JsonViewerChromeColors
}

export function JsonViewerEmbed({
  json,
  className,
  defaultView,
  lockedView,
  syntaxTheme,
  onSettingsEventName,
  readDefaultView,
  readSyntaxTheme,
  onFullscreen,
  chromeTheme,
  chromeColors,
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

  const resolvedDefaultView = lockedView ?? defaultView ?? readDefaultView?.() ?? DEFAULT_JSON_VIEWER_HUMAN_VIEW
  const resolvedSyntaxTheme =
    syntaxTheme ?? readSyntaxTheme?.() ?? DEFAULT_JSON_VIEWER_SYNTAX_THEME
  const showFullscreen = !!onFullscreen
  const chromeColorsKey = `${chromeTheme ?? ""}:${chromeColors?.bg ?? ""}:${chromeColors?.fg ?? ""}:${chromeColors?.accent ?? ""}`
  const stableChromeColors = useMemo(
    () => chromeColors,
    [chromeColorsKey], // eslint-disable-line react-hooks/exhaustive-deps
  )

  function sendLoad() {
    post({
      type: JSON_VIEWER_MESSAGE_LOAD,
      json,
      defaultView: resolvedDefaultView,
      lockedView,
      syntaxTheme: resolvedSyntaxTheme,
      showFullscreen,
      chromeTheme,
      chromeColors: stableChromeColors,
    })
  }

  useEffect(() => {
    sendLoad()
  }, [json, resolvedDefaultView, lockedView, resolvedSyntaxTheme, showFullscreen, chromeTheme, chromeColorsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onSettingsEventName) return
    const onSettings = () => {
      post({
        type: JSON_VIEWER_MESSAGE_SETTINGS,
        defaultView: lockedView ?? defaultView ?? readDefaultView?.() ?? DEFAULT_JSON_VIEWER_HUMAN_VIEW,
        lockedView,
        syntaxTheme: syntaxTheme ?? readSyntaxTheme?.() ?? DEFAULT_JSON_VIEWER_SYNTAX_THEME,
        showFullscreen: !!onFullscreenRef.current,
        chromeTheme,
        chromeColors: stableChromeColors,
      })
    }
    window.addEventListener(onSettingsEventName, onSettings)
    return () => window.removeEventListener(onSettingsEventName, onSettings)
  }, [onSettingsEventName, defaultView, lockedView, syntaxTheme, readDefaultView, readSyntaxTheme, chromeTheme, chromeColorsKey])

  useEffect(() => {
    if (!onFullscreen) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.source !== iframeRef.current?.contentWindow) return
      if (!e.data || e.data.type !== JSON_VIEWER_MESSAGE_FULLSCREEN) return
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
