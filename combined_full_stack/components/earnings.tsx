"use client"

import { useState } from "react"
import { ArrowRightLeft, CircleDollarSign, Loader2, Wallet } from "lucide-react"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { formatCents } from "@/lib/format"
import { useWorkspaceBilling } from "@/lib/use-workspace-billing"
import { useWorkspaceEarnings } from "@/lib/use-workspace-earnings"
import { Button } from "@/components/ui/button"
import { useAppShell } from "@/lib/app-shell"

export function Earnings() {
  const { earningsAccount, refreshEarnings } = useWorkspaceEarnings()
  const { refreshBilling } = useWorkspaceBilling()
  const { setActiveWindow } = useAppShell()
  const [banner, setBanner] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)

  async function withdrawAllEarnings() {
    if (!earningsAccount || earningsAccount.balanceCents <= 0) return
    setWithdrawing(true)
    setBanner(null)
    try {
      const res = await fetch(API_ROUTES.earningsWithdraw, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ cents: earningsAccount.balanceCents }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Withdraw failed")
      await Promise.all([refreshEarnings({ force: true }), refreshBilling({ force: true })])
    } catch (e) {
      setBanner((e as Error).message)
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl space-y-4">
          {banner && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {banner}
            </p>
          )}

          {!earningsAccount ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  Available balance
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold text-primary">
                  {formatCents(earningsAccount.balanceCents)}
                </p>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  {formatCents(earningsAccount.totalEarnedCents)} lifetime earned ·{" "}
                  {formatCents(earningsAccount.totalWithdrawnCents)} moved to LLM credit
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card px-5 py-4">
                <div className="flex items-start gap-3">
                  <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      When someone runs your viewer-funded links or billable APIs, you earn everything
                      above measured LLM cost — billing multiple and flat fees included.
                    </p>
                    <p>
                      Earnings land here first, not in Billing. Move them to LLM credit when you want to
                      spend on your own pipeline runs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={withdrawing || earningsAccount.balanceCents <= 0}
                  onClick={() => withdrawAllEarnings().catch(console.error)}
                >
                  {withdrawing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Move to LLM credit
                </Button>
                <Button type="button" variant="ghost" onClick={() => refreshEarnings().catch(console.error)}>
                  Refresh
                </Button>
                <Button type="button" variant="ghost" onClick={() => setActiveWindow("billing")}>
                  Open Billing
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
