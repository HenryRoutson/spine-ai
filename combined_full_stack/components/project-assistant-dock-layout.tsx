"use client"

import { useCallback, useEffect, type ReactNode } from "react"
import { ResizableSplit } from "@/components/resizable-split"
import { ProjectAssistantDockPanel } from "@/components/project-assistant-dock"
import { assistantDockSplit } from "@/lib/layout-split-settings"
import { useAnimatedPaneWidth } from "@/lib/use-animated-pane-width"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
import { useProjectAssistant } from "@/lib/project-assistant-context"

type pixel_width = number

type ProjectAssistantDockLayoutProps = {
  children: ReactNode
  forceOpen?: boolean
}

// AI : agent stays on the left — people treat the left pane as the primary control.
export function ProjectAssistantDockLayout({ children, forceOpen = false }: ProjectAssistantDockLayoutProps) {
  const { open: assistantOpen, setOpen } = useProjectAssistant()
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen, setOpen])
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
      fixedSide="leading"
      leadingWidth={width}
      onLeadingWidthChange={handleWidthChange}
      onLeadingWidthCommit={commitAssistantWidth}
      minLeading={assistantDockSplit.min}
      maxLeading={assistantDockSplit.max}
      animateWidth
      widthTransitionMs={durationMs}
      onFixedPaneTransitionEnd={onPaneTransitionEnd}
      leading={<ProjectAssistantDockPanel embedded={forceOpen} />}
      trailing={children}
    />
  )
}
