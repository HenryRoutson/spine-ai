"use client"

// AI : Supabase Realtime keeps team shared-pointer rows fresh across browsers/instances.
import { useEffect, useRef } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/utils/supabase/client"
import { isDemoMode, isPreviewOnly } from "@/lib/demo-mode"

const DEBOUNCE_MS = 400

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
    let projectsTimer: ReturnType<typeof setTimeout> | null = null
    let runsTimer: ReturnType<typeof setTimeout> | null = null
    let membersTimer: ReturnType<typeof setTimeout> | null = null

    void (async () => {
      try {
        const supabase = await createClient()
        if (cancelled) return

        const bumpProjects = () => {
          if (projectsTimer) clearTimeout(projectsTimer)
          projectsTimer = setTimeout(() => projectsRef.current(), DEBOUNCE_MS)
        }
        const bumpRuns = () => {
          if (runsTimer) clearTimeout(runsTimer)
          runsTimer = setTimeout(() => runsRef.current(), DEBOUNCE_MS)
        }
        const bumpMembers = () => {
          if (membersTimer) clearTimeout(membersTimer)
          membersTimer = setTimeout(() => membersRef.current(), DEBOUNCE_MS)
        }

        channel = supabase
          .channel("team-shared-pointers")
          .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, bumpProjects)
          .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, bumpProjects)
          .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, bumpRuns)
          .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, bumpMembers)
          .subscribe()
      } catch (err) {
        console.warn("team realtime unavailable", err)
      }
    })()

    return () => {
      cancelled = true
      if (projectsTimer) clearTimeout(projectsTimer)
      if (runsTimer) clearTimeout(runsTimer)
      if (membersTimer) clearTimeout(membersTimer)
      const ch = channel
      if (ch) {
        void createClient().then((supabase) => {
          void supabase.removeChannel(ch)
        })
      }
    }
  }, [enabled])
}
