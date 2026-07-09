"use client"

// AI : thin app wrapper — shared embed + localStorage prefs from lib/json-viewer.

import { JsonViewerEmbed as SharedJsonViewerEmbed } from "@shared/json-viewer/embed"
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
}

export function JsonViewerEmbed({ json, className, defaultView }: JsonViewerEmbedProps) {
  return (
    <SharedJsonViewerEmbed
      json={json}
      className={cn("w-full border-0 bg-background", className)}
      defaultView={defaultView}
      onSettingsEventName={JSON_VIEWER_SETTINGS_CHANGED_EVENT}
      readDefaultView={readJsonViewerDefaultView}
      readSyntaxTheme={readJsonViewerSyntaxTheme}
    />
  )
}
