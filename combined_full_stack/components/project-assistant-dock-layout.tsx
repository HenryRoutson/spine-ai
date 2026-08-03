"use client"

import { useCallback, type ReactNode } from "react"
import { ResizableSplit } from "@/components/resizable-split"
import { ProjectAssistantDockPanel } from "@/components/project-assistant-dock"
import { assistantDockSplit } from "@/lib/layout-split-settings"
import { useAnimatedPaneWidth } from "@/lib/use-animated-pane-width"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { useProjectAssistant } from "@/lib/project-assistant-context"

type pixel_width = number

type ProjectAssistantDockLayoutProps = {
  children: ReactNode
}

// AI : agent slides in from the right — pushes page content, does not overlay it.
export function ProjectAssistantDockLayout({ children }: ProjectAssistantDockLayoutProps) {
  const { open: assistantOpen } = useProjectAssistant()
  const {
    width: assistantWidth,
    setWidth: setAssistantWidth,
    commitWidth: commitAssistantWidth,
  } = usePersistedLeadingWidth(assistantDockSplit)
  const { mounted, width, setPaneWidth, onPaneTransitionEnd, durationMs } = useAnimatedPaneWidth(
    assistantOpen,
    assistantWidth,
  )

  const handleWidthChange = useCallback(
    (nextWidth: pixel_width) => {
      setPaneWidth(nextWidth)
      setAssistantWidth(nextWidth)
    },
    [setAssistantWidth, setPaneWidth],
  )

  if (!mounted) return children

  return (
    <ResizableSplit
      className="min-h-0 flex-1"
      fixedSide="trailing"
      leadingWidth={width}
      onLeadingWidthChange={handleWidthChange}
      onLeadingWidthCommit={commitAssistantWidth}
      minLeading={assistantDockSplit.min}
      maxLeading={assistantDockSplit.max}
      animateWidth
      widthTransitionMs={durationMs}
      onFixedPaneTransitionEnd={onPaneTransitionEnd}
      leading={children}
      trailing={<ProjectAssistantDockPanel />}
    />
  )
}
