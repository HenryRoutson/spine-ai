"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { readActiveProjectSession } from "@/lib/active-project-session"

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!readActiveProjectSession()) {
      router.replace("/projects")
      return
    }
    setReady(true)
  }, [router])

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="font-mono text-xs text-muted-foreground">loading…</p>
      </div>
    )
  }

  return children
}
