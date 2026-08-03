"use client"

import { CreditCard, Hammer, Loader2, Play, Settings } from "lucide-react"
import { prefetchBillingPanel } from "@/lib/prefetch-billing-panel"
import { prefetchRunPanel } from "@/lib/prefetch-run-panel"
import { prefetchSettingsPanel } from "@/lib/prefetch-settings-panel"
import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useCallback } from "react"

export type AppPrimarySection = "run" | "build" | "billing" | "settings"

type AppPrimaryNavProps = {
  value: AppPrimarySection
  onChange: (section: AppPrimarySection) => void
  openingSection?: AppPrimarySection | null
  className?: string
}

// AI : L0 — Run, Build, Billing, and Settings at the same level (spec navigation model).
export function AppPrimaryNav({ value, onChange, openingSection = null, className }: AppPrimaryNavProps) {
  const warmRun = useWarmRun()
  const warmBilling = useWarmBilling()
  const warmSettings = useWarmSettings()

  return (
    <div
      role="group"
      aria-label="App sections"
      className={cn(
        "inline-flex shrink-0 flex-wrap rounded-lg border border-border bg-muted/30 p-0.5",
        className,
      )}
    >
      <PrimaryButton
        active={value === "run"}
        loading={openingSection === "run"}
        onClick={() => onChange("run")}
        onWarm={warmRun}
        icon={Play}
        label="Run shared pipelines"
        shortLabel="Run"
        title="Run pipelines someone shared with you"
      />
      <PrimaryButton
        active={value === "build"}
        loading={openingSection === "build"}
        onClick={() => onChange("build")}
        icon={Hammer}
        label="Build pipelines"
        shortLabel="Build"
        title="Create and edit your own pipelines"
      />
      <PrimaryButton
        active={value === "billing"}
        loading={openingSection === "billing"}
        onClick={() => onChange("billing")}
        onWarm={warmBilling}
        icon={CreditCard}
        label="Billing"
        shortLabel="Billing"
        title="Usage, credits, and cost attribution"
      />
      <PrimaryButton
        active={value === "settings"}
        loading={openingSection === "settings"}
        onClick={() => onChange("settings")}
        onWarm={warmSettings}
        icon={Settings}
        label="Settings"
        shortLabel="Settings"
        title="Account and workspace settings"
      />
    </div>
  )
}

function PrimaryButton({
  active,
  loading = false,
  onClick,
  onWarm,
  icon: Icon,
  label,
  shortLabel,
  title,
}: {
  active: boolean
  loading?: boolean
  onClick: () => void
  onWarm?: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortLabel: string
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={onWarm}
      onFocus={onWarm}
      aria-busy={loading}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-2.5",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        loading && "cursor-wait",
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function useWarmRun() {
  return useCallback(() => {
    prefetchRunPanel()
  }, [])
}

function useWarmBilling() {
  const builder = useOptionalStore()
  const consumer = useOptionalConsumerStore()
  return useCallback(() => {
    prefetchBillingPanel()
    void (builder ?? consumer)?.refreshBilling()
  }, [builder, consumer])
}

function useWarmSettings() {
  return useCallback(() => {
    prefetchSettingsPanel()
  }, [])
}
