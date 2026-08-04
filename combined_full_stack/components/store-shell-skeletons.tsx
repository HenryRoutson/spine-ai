"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { SpineLogoBox } from "@/components/spine-mark"

const SKELETON_HINT_DELAY_MS = 2000

function useShowAfterDelay(delayMs: number) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs)
    return () => window.clearTimeout(id)
  }, [delayMs])
  return show
}

function DelayedLoadingHint({ message }: { message: string }) {
  const show = useShowAfterDelay(SKELETON_HINT_DELAY_MS)
  if (!show) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center px-4"
    >
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        <span className="font-mono text-[11px] text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}

function ShellSkeletonFrame({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {children}
      <DelayedLoadingHint message={message} />
    </div>
  )
}

function AppChromeHeaderSkeleton({ showProjectSlot = false }: { showProjectSlot?: boolean }) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <SpineLogoBox />
        <Skeleton className="hidden h-4 w-20 sm:block" />
      </div>
      <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:block" />
      <div className="inline-flex shrink-0 flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-md" />
        ))}
      </div>
      {showProjectSlot ? (
        <>
          <div className="h-6 w-px shrink-0 bg-border" />
          <Skeleton className="h-8 w-40" />
        </>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </header>
  )
}

function WindowHeaderSkeleton({ actionCount = 2 }: { actionCount?: number }) {
  if (actionCount <= 0) return null
  return (
    <div className="flex items-center justify-end gap-2 border-b border-border px-5 py-2">
      {Array.from({ length: actionCount }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-28" />
      ))}
    </div>
  )
}

function WorkspaceNavSkeleton({ tabs = 8 }: { tabs?: number }) {
  return (
    <nav
      aria-hidden="true"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-muted/15 px-4 py-2"
    >
      {Array.from({ length: tabs }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-24 rounded-md" />
      ))}
    </nav>
  )
}

function ProjectListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </li>
      ))}
    </ul>
  )
}

function StructurePanelSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="hidden w-52 shrink-0 space-y-2 border-r border-border p-3 sm:block">
        <Skeleton className="h-3 w-16" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    </div>
  )
}

export function ProjectPickerSkeleton() {
  return (
    <ShellSkeletonFrame message="Loading projects…">
      <AppChromeHeaderSkeleton />
      <div className="flex min-h-0 flex-1 flex-col">
        <WindowHeaderSkeleton actionCount={2} />
        <div className="min-h-0 flex-1 overflow-hidden p-5">
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-8" />
          </div>
          <ProjectListSkeleton rows={4} />
          <div className="mt-8 space-y-3">
            <Skeleton className="h-4 w-36" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ShellSkeletonFrame>
  )
}

export function StoreShellSkeleton({ variant = "builder" }: { variant?: "builder" | "minimal" }) {
  if (variant === "minimal") {
    return (
      <ShellSkeletonFrame message="Loading workspace…">
        <AppChromeHeaderSkeleton showProjectSlot />
        <div className="flex min-h-0 flex-1 items-center justify-center p-5">
          <div className="w-full max-w-md space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </ShellSkeletonFrame>
    )
  }

  return (
    <ShellSkeletonFrame message="Loading workspace…">
      <AppChromeHeaderSkeleton showProjectSlot />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <WorkspaceNavSkeleton />
        <div className="flex min-h-0 flex-1 flex-col">
          <StructurePanelSkeleton />
        </div>
      </main>
    </ShellSkeletonFrame>
  )
}
