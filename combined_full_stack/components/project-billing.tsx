"use client"

import { useEffect, useMemo } from "react"
import { CreditCard } from "lucide-react"
import { useWorkspaceBilling } from "@/lib/use-workspace-billing"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { AppPrimarySection, AppPrimarySectionTitle } from "@/lib/app-primary-section-labels"
import { isSharedRun } from "@/lib/shared-link-types"
import { useAppShell } from "@/lib/app-shell"
import { BillingSpendSection } from "@/components/billing-shared"
import { handlePrimarySectionChange } from "@/lib/app-primary-section"
import { useOptionalStore } from "@/lib/store"
import { AppMode, navigateToBuildMode, navigateToRunMode } from "@/lib/app-mode-nav"

export function ProjectBilling() {
  const builder = useOptionalStore()
  const mode = builder ? AppMode.Build : AppMode.Run
  const { runs, billingRuns, project, refreshBillingRuns } = useWorkspaceBilling()
  const { setActiveWindow } = useAppShell()

  useEffect(() => {
    void refreshBillingRuns().catch(console.error)
  }, [refreshBillingRuns])

  const scopedRuns = useMemo(() => {
    if (mode === AppMode.Run) return billingRuns.filter((run) => isSharedRun(run))
    return runs
  }, [mode, runs, billingRuns])

  const scopeLabel =
    mode === AppMode.Run
      ? AppPrimarySectionTitle.Run
      : project
        ? project.name
        : "This project"

  function openAccountBilling() {
    handlePrimarySectionChange(
      AppPrimarySection.Billing,
      mode,
      "project-billing",
      setActiveWindow,
      navigateToRunMode,
      navigateToBuildMode,
    )
  }

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        actions={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openAccountBilling}>
            <CreditCard className="h-3.5 w-3.5" />
            Account billing
          </Button>
        }
      />
      <BillingSpendSection runs={scopedRuns} scopeLabel={scopeLabel} chartScope={mode === AppMode.Run ? "shared" : "project"} />
    </div>
  )
}
