"use client"

// AI : thin app wrapper — shared embed + localStorage prefs from lib/json-viewer.

import { JsonViewerEmbed as SharedJsonViewerEmbed } from "@shared/json-viewer/embed"
import { useHostedFunctionChrome } from "@/components/share/hosted-function-chrome"
import {
  JSON_VIEWER_SETTINGS_CHANGED_EVENT,
  readJsonViewerDefaultView,
  readJsonViewerSyntaxTheme,
  type JsonViewerHumanViewId,
} from "@/lib/json-viewer"
import { cn } from "@/lib/utils"

interface JsonViewerEmbedProps {
  json: string
  className?: string
  // AI : per-embed override — inference final output defaults to table without changing global prefs
  defaultView?: JsonViewerHumanViewId
  lockedView?: JsonViewerHumanViewId
  onFullscreen?: () => void
}

export function JsonViewerEmbed({
  json,
  className,
  defaultView,
  lockedView,
  onFullscreen,
}: JsonViewerEmbedProps) {
  const chrome = useHostedFunctionChrome()
  return (
    <SharedJsonViewerEmbed
      json={json}
      className={cn("w-full border-0 bg-background", className)}
      defaultView={defaultView}
      lockedView={lockedView}
      onFullscreen={onFullscreen}
      onSettingsEventName={JSON_VIEWER_SETTINGS_CHANGED_EVENT}
      readDefaultView={readJsonViewerDefaultView}
      readSyntaxTheme={readJsonViewerSyntaxTheme}
      chromeTheme={chrome?.theme}
      chromeColors={
        chrome ? { bg: chrome.bg, fg: chrome.fg, accent: chrome.accent } : undefined
      }
    />
  )
}
