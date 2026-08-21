"use client"

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
const Logging = dynamic(() => import("@/components/logging").then((m) => ({ default: m.Logging })), {
  loading: () => <PanelLoading label="loading logging…" />,
})

function renderObservePanel(tab: VibeObserveTab) {
  switch (tab) {
    case AppWindowId.Inference:
      return <Inference simple />
    case AppWindowId.Logging:
      return <Logging listDensity="compact" simple />
  }
}

// AI : chat left (create/edit from scratch); Inference + Logging on the right — existing panels, observe only.
export function VibePanel() {
  useMarkPrimarySectionReady(AppPrimarySection.Build)
  const { vibeObserveTab, setVibeObserveTab } = useAppShell()
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
