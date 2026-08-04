"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Loader2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SharedRunPanel } from "@/components/share/shared-run-panel"
import { ErrorBanner } from "@/components/inference/inference-run-chrome"
import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { fetchSharedLink } from "@/lib/shared-run-client"
import { useAppShell } from "@/lib/app-shell"
import { useWorkspaceBilling } from "@/lib/use-workspace-billing"
import { useSupabaseSession } from "@/lib/use-supabase-session"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import { addSharedWithMe, updateSharedWithMeName } from "@/lib/shared-with-me"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"

export function SharedLinkRunner({ linkId }: { linkId: string }) {
  const { clearSharedRun, setActiveWindow } = useAppShell()
  const { refreshBilling, billingAccount } = useWorkspaceBilling()
  const { isAuthenticated, ready: authReady } = useSupabaseSession()
  const [link, setLink] = useState<SharedLinkPublicView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchSharedLink(linkId)
      .then((loaded) => {
        setLink(loaded)
        addSharedWithMe(linkId, loaded.name)
      })
      .catch((e) => setLoadError((e as Error).message))
  }, [linkId])

  const onRunComplete = useCallback(() => {
    void refreshBilling()
  }, [refreshBilling])

  const minRunBalanceCents = billingAccount?.minRunBalanceCents ?? MIN_RUN_BALANCE_CENTS
  const viewerPays = link != null && viewerFundsSharedRun(link.fundingMode)
  const insufficientCredit =
    viewerPays &&
    isAuthenticated &&
    billingAccount != null &&
    billingAccount.balanceCents < minRunBalanceCents

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <ErrorBanner text={loadError} />
        <Button variant="outline" size="sm" className="mt-4" onClick={clearSharedRun}>
          Back to Run
        </Button>
      </div>
    )
  }

  if (!link || !authReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={clearSharedRun}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Run
        </Button>
        <Share2 className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{link.name}</h2>
          {link.description ? (
            <p className="truncate text-xs text-muted-foreground">{link.description}</p>
          ) : null}
        </div>
        <Badge variant="outline" className="font-mono text-[9px]">
          shared pipeline
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-4xl">
          <SharedRunPanel
            link={link}
            linkId={linkId}
            isAuthenticated={isAuthenticated}
            onAuthRequired={() => {
              window.location.href = `/login?next=${encodeURIComponent("/")}`
            }}
            onRunComplete={() => {
              updateSharedWithMeName(linkId, link.name)
              onRunComplete()
            }}
            insufficientCredit={insufficientCredit}
            onOpenBilling={() => setActiveWindow("billing")}
          />
        </div>
      </div>
    </div>
  )
}
