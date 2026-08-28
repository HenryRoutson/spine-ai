"use client"

// AI : TODO (spine-in-spine-bootstrap-S10-flag) — guest replacement for this shell is hosted page /
// AI :   ({{chatbot}} + {{run:active-user-project}}). Do not port this split; compose slots.
// AI :   Cut over from AppShellLayout when SPINE_IN_SPINE_UI is on. See bootstrap roadmap S10.

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { AppWindowNav } from "@/components/app-window-nav"
import { PanelLoading } from "@/components/panel-loading"
import { ProjectAssistantDockPanel } from "@/components/project-assistant-dock"
import { ResizableSplit } from "@/components/resizable-split"
import {
  isVibeObserveTab,
  VIBE_OBSERVE_NAV_ITEMS,
  type VibeObserveTab,
} from "@/lib/app-nav-config"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { useAppShell } from "@/lib/app-shell"
import { AppWindowId } from "@/lib/app-window-id"
import { vibeChatSplit } from "@/lib/layout-split-settings"
import { prefetchWorkspacePanel } from "@/lib/prefetch-workspace-panel"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { cn } from "@/lib/utils"

const Inference = dynamic(() => import("@/components/inference").then((m) => ({ default: m.Inference })), {
  loading: () => <PanelLoading label="loading inference…" />,
})
const Share = dynamic(() => import("@/components/share/share-page").then((m) => ({ default: m.SharePage })), {
  loading: () => <PanelLoading label="loading share…" />,
})
const Logging = dynamic(() => import("@/components/logging").then((m) => ({ default: m.Logging })), {
  loading: () => <PanelLoading label="loading logging…" />,
})
const Schedule = dynamic(() => import("@/components/schedule-page").then((m) => ({ default: m.SchedulePage })), {
  loading: () => <PanelLoading label="loading schedule…" />,
})

function renderObservePanel(tab: VibeObserveTab) {
  switch (tab) {
    case AppWindowId.Inference:
      return <Inference simple />
    case AppWindowId.Schedule:
      return <Schedule simple />
    case AppWindowId.Share:
      return <Share simple />
    case AppWindowId.Logging:
      return <Logging listDensity="compact" simple />
  }
}

// AI : chat left (create/edit from scratch); Inference / Schedule / Share / Logging on the right.
// AI : DONE (media-view-A-share) — InferenceRunOutputs → DataViewPanel; Play tab works in simple / share / embed.
export function VibePanel() {
  useMarkPrimarySectionReady(AppPrimarySection.Build)
  const { vibeObserveTab, setVibeObserveTab, editingWebsite } = useAppShell()
  const { width, setWidth, commitWidth } = usePersistedLeadingWidth(vibeChatSplit)
  const [mountedObserve, setMountedObserve] = useState<Set<VibeObserveTab>>(
    () => new Set([vibeObserveTab]),
  )

  useEffect(() => {
    prefetchWorkspacePanel(vibeObserveTab)
    setMountedObserve((prev) => {
      if (prev.has(vibeObserveTab)) return prev
      const next = new Set(prev)
      next.add(vibeObserveTab)
      return next
    })
  }, [vibeObserveTab])

  if (editingWebsite) {
    // AI : Website vibe is the page studio only — Inference/Schedule live on the opened pipeline.
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Share simple />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ResizableSplit
        className="min-h-0 flex-1"
        leading={<ProjectAssistantDockPanel embedded />}
        trailing={
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AppWindowNav
              activeWindow={vibeObserveTab}
              onSelect={(window) => {
                if (isVibeObserveTab(window)) setVibeObserveTab(window)
              }}
              items={VIBE_OBSERVE_NAV_ITEMS}
            />
            <div className="relative min-h-0 flex-1">
              {VIBE_OBSERVE_NAV_ITEMS.map((item) => {
                const tab = item.id
                if (!isVibeObserveTab(tab) || !mountedObserve.has(tab)) return null
                return (
                  <div
                    key={tab}
                    className={cn(
                      "absolute inset-0 flex min-h-0 flex-col",
                      tab !== vibeObserveTab && "hidden",
                    )}
                    aria-hidden={tab !== vibeObserveTab}
                  >
                    {renderObservePanel(tab)}
                  </div>
                )
              })}
            </div>
          </div>
        }
        leadingWidth={width}
        onLeadingWidthChange={setWidth}
        onLeadingWidthCommit={commitWidth}
        minLeading={vibeChatSplit.min}
        maxLeading={vibeChatSplit.max}
      />
    </div>
  )
}
