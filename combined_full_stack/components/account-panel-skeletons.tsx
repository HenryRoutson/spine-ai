"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { WindowHeader } from "@/components/window-header"
import { cn } from "@/lib/utils"

function CardSectionSkeleton({
  titleWidth = "w-28",
  rows = 3,
}: {
  titleWidth?: string
  rows?: number
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <Skeleton className={cn("h-4", titleWidth)} />
        <Skeleton className="mt-2 h-3 w-2/3 max-w-xs" />
      </div>
      <div className="space-y-3 px-4 py-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}

export function BillingStatsSkeleton() {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border">
      <div className="space-y-2 bg-card px-4 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="space-y-2 bg-card px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  )
}

export function BillingBalanceSkeleton() {
  return (
    <div className="relative z-10 shrink-0 border-b border-border bg-card px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  )
}

export function BillingKeysListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-2.5">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-16" />
        </li>
      ))}
    </ul>
  )
}

export function BillingPanelSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="11 / Billing"
        title="LLM credit & spend"
        description="Credit for pipeline runs — subscribe or top up here."
      />
      <BillingBalanceSkeleton />
      <BillingStatsSkeleton />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="aspect-[3/1] w-full" />
        </div>
        <div className="mt-4 space-y-4">
          <CardSectionSkeleton titleWidth="w-32" rows={3} />
          <CardSectionSkeleton titleWidth="w-28" rows={2} />
        </div>
      </div>
    </div>
  )
}

export function SettingsAccountRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <Skeleton className="h-4 w-48 max-w-[70%]" />
      <Skeleton className="h-8 w-24" />
    </div>
  )
}

export function TeamSettingsSkeleton() {
  return (
    <div className="space-y-3 px-4 py-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-28 w-full rounded-md" />
    </div>
  )
}

export function SettingsPanelSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="11 / Settings"
        title="Settings"
        description="App preferences — stored locally in your browser."
      />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-44 shrink-0 space-y-1 border-r border-border p-2 sm:block">
          <Skeleton className="mx-2 mb-2 h-3 w-16" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="mx-auto flex max-w-lg flex-col gap-4">
            <CardSectionSkeleton titleWidth="w-16" rows={4} />
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <Skeleton className="h-4 w-20" />
              </div>
              <SettingsAccountRowSkeleton />
            </div>
            <CardSectionSkeleton titleWidth="w-28" rows={2} />
            <CardSectionSkeleton titleWidth="w-24" rows={3} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function MarketplaceListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-5 w-12 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MarketplaceDetailSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-48 w-full rounded-md" />
      <Skeleton className="h-8 w-36" />
    </div>
  )
}

export function SharedWithMeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-16" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function RunPanelSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="Shared with me"
        title="Run shared pipelines"
        description="Paste a link someone shared with you, browse the marketplace, or top up in Billing."
      />
      <div className="border-b border-border px-5">
        <div className="mx-auto flex max-w-6xl gap-2 py-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl">
          <SharedWithMeSkeleton />
        </div>
      </div>
    </div>
  )
}

export function PrivacyMarketingSkeleton() {
  return (
    <label className="flex items-start gap-3">
      <Skeleton className="mt-0.5 h-5 w-9 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
      </span>
    </label>
  )
}
