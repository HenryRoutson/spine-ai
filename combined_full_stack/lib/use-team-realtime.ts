"use client"

// AI : Supabase Realtime keeps team shared-pointer rows fresh across browsers/instances.
import { useEffect, useRef } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { tryCreateClient } from "@/utils/supabase/client"
import { isDemoMode, isPreviewOnly } from "@/lib/demo-mode"
import {
  TEAM_REALTIME_CHANNEL,
  TEAM_REALTIME_DEBOUNCE_MS,
  attachRealtimePort,
  createMemoryRealtimePort,
  subscribeTeamRealtimeChannel,
} from "@/lib/core/realtime"

type TeamRealtimeOpts = {
  enabled: boolean
  onProjectsChanged: () => void
  onRunsChanged: () => void
  onMembershipChanged: () => void
}

export function useTeamRealtime({
  enabled,
  onProjectsChanged,
  onRunsChanged,
  onMembershipChanged,
}: TeamRealtimeOpts): void {
  const projectsRef = useRef(onProjectsChanged)
  const runsRef = useRef(onRunsChanged)
  const membersRef = useRef(onMembershipChanged)
  projectsRef.current = onProjectsChanged
  runsRef.current = onRunsChanged
  membersRef.current = onMembershipChanged

  useEffect(() => {
    if (!enabled || isDemoMode() || isPreviewOnly()) return

    let cancelled = false
    let channel: RealtimeChannel | null = null
    let stop: (() => void) | null = null

    void (async () => {
      try {
        const supabase = await tryCreateClient()
        if (!supabase || cancelled) return

        const bus = createMemoryRealtimePort()
        stop = attachRealtimePort(
          bus,
          {
            onProjectsChanged: () => projectsRef.current(),
            onRunsChanged: () => runsRef.current(),
            onMembershipChanged: () => membersRef.current(),
          },
          TEAM_REALTIME_DEBOUNCE_MS,
        )
        channel = subscribeTeamRealtimeChannel(
          supabase.channel(TEAM_REALTIME_CHANNEL) as never,
          (event) => bus.emit(event),
        ) as unknown as RealtimeChannel
      } catch (err) {
        console.warn("team realtime unavailable", err)
      }
    })()

    return () => {
      cancelled = true
      stop?.()
      const ch = channel
      if (ch) {
        void tryCreateClient().then((supabase) => {
          if (supabase) void supabase.removeChannel(ch)
        })
      }
    }
  }, [enabled])
}
