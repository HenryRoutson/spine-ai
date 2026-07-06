"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

export function useSupabaseSession() {
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    void createClient().then(async (supabase) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled) {
        setEmail(session?.user?.email ?? null)
        setReady(true)
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
        setEmail(session?.user?.email ?? null)
      })
      unsub = () => subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = await createClient()
    await supabase.auth.signOut()
    setEmail(null)
  }, [])

  return { email, isAuthenticated: email != null, ready, signOut }
}
