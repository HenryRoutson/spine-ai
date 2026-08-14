"use client"

import { CreditCard, Hammer, Loader2, Play, Settings } from "lucide-react"
import { APP_PRIMARY_SECTION_NAV, AppPrimarySection } from "@/lib/app-primary-section-labels"
import { prefetchBillingPanel } from "@/lib/prefetch-billing-panel"
import { prefetchBuildPanel } from "@/lib/prefetch-build-panel"
import { prefetchRunPanel } from "@/lib/prefetch-run-panel"
import { prefetchSettingsPanel } from "@/lib/prefetch-settings-panel"
import { prefetchWorkspacePanel } from "@/lib/prefetch-workspace-panel"
import { AppWindowId } from "@/lib/app-window-id"
import { useOptionalConsumerStore, useOptionalStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { spineActionProps } from "@/lib/core/parity"
import { useCallback, useEffect } from "react"

export { AppPrimarySection } from "@/lib/app-primary-section-labels"

type AppPrimaryNavProps = {
  value: AppPrimarySection
  onChange: (section: AppPrimarySection) => void
  openingSection?: AppPrimarySection | null
  className?: string
}

// AI : L0 — Run, Build, Billing, Settings (Vibe lives under Build as a surface toggle).
export function AppPrimaryNav({ value, onChange, openingSection = null, className }: AppPrimaryNavProps) {
  const warmRun = useWarmRun()
  const warmBuild = useWarmBuild()
  const warmBilling = useWarmBilling()
  const warmSettings = useWarmSettings()

  useEffect(() => {
    prefetchBillingPanel()
  }, [])

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
        active={value === AppPrimarySection.Run}
        loading={openingSection === AppPrimarySection.Run}
        onClick={() => onChange(AppPrimarySection.Run)}
        onWarm={warmRun}
        icon={Play}
        spineId="nav.run"
        {...APP_PRIMARY_SECTION_NAV[AppPrimarySection.Run]}
      />
      <PrimaryButton
        active={value === AppPrimarySection.Build}
        loading={openingSection === AppPrimarySection.Build}
        onClick={() => onChange(AppPrimarySection.Build)}
        onWarm={warmBuild}
        icon={Hammer}
        spineId="nav.build"
        {...APP_PRIMARY_SECTION_NAV[AppPrimarySection.Build]}
      />
      <PrimaryButton
        active={value === AppPrimarySection.Billing}
        loading={openingSection === AppPrimarySection.Billing}
        onClick={() => onChange(AppPrimarySection.Billing)}
        onWarm={warmBilling}
        icon={CreditCard}
        spineId="nav.billing"
        {...APP_PRIMARY_SECTION_NAV[AppPrimarySection.Billing]}
      />
      <PrimaryButton
        active={value === AppPrimarySection.Settings}
        loading={openingSection === AppPrimarySection.Settings}
        onClick={() => onChange(AppPrimarySection.Settings)}
        onWarm={warmSettings}
        icon={Settings}
        spineId="nav.settings"
        {...APP_PRIMARY_SECTION_NAV[AppPrimarySection.Settings]}
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
  title,
  spineId,
}: {
  active: boolean
  loading?: boolean
  onClick: () => void
  onWarm?: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  title: string
  spineId: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={onWarm}
      onFocus={onWarm}
      aria-busy={loading}
      {...spineActionProps(spineId)}
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
      <span>{label}</span>
    </button>
  )
}

function useWarmBuild() {
  return useCallback(() => {
    prefetchWorkspacePanel(AppWindowId.Vibe)
    prefetchBuildPanel()
  }, [])
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
