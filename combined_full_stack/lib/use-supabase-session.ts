"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { tryCreateClient } from "@/utils/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

export function useSupabaseSession(isolated?: { url: string; anonKey: string } | null) {
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const url = isolated?.url ?? ""
  const anonKey = isolated?.anonKey ?? ""

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    void (async () => {
      let supabase: SupabaseClient | null = null
      if (url && anonKey) {
        supabase = createBrowserClient(url, anonKey, {
          auth: { persistSession: true, storageKey: `spine-site:${url}` },
        })
      } else {
        supabase = await tryCreateClient()
      }
      if (!supabase) {
        if (!cancelled) setReady(true)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled) {
        setEmail(session?.user?.email ?? null)
        setReady(true)
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
        setEmail(session?.user?.email ?? null)
      })
      unsub = () => subscription.unsubscribe()
    })()
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [url, anonKey])

  const signOut = useCallback(async () => {
    if (url && anonKey) {
      const supabase = createBrowserClient(url, anonKey, {
        auth: { persistSession: true, storageKey: `spine-site:${url}` },
      })
      await supabase.auth.signOut()
    } else {
      const supabase = await tryCreateClient()
      if (supabase) await supabase.auth.signOut()
    }
    setEmail(null)
  }, [url, anonKey])

  return { email, isAuthenticated: email != null, ready, signOut }
}
