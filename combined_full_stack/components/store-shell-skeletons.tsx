"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { SpineLogoBox } from "@/components/spine-mark"

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
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      {actionCount > 0 ? (
        <div className="flex shrink-0 items-center gap-2">
          {Array.from({ length: actionCount }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      ) : null}
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
    <div className="flex h-dvh flex-col bg-background text-foreground">
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
    </div>
  )
}

export function StoreShellSkeleton({ variant = "builder" }: { variant?: "builder" | "minimal" }) {
  if (variant === "minimal") {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <AppChromeHeaderSkeleton showProjectSlot />
        <div className="flex min-h-0 flex-1 items-center justify-center p-5">
          <div className="w-full max-w-md space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <AppChromeHeaderSkeleton showProjectSlot />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <WorkspaceNavSkeleton />
        <div className="flex min-h-0 flex-1 flex-col">
          <WindowHeaderSkeleton actionCount={1} />
          <StructurePanelSkeleton />
        </div>
      </main>
    </div>
  )
}
