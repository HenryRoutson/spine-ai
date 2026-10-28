"use client"

import { MIN_RUN_BALANCE_CENTS } from "@/lib/billing_config"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { formatCents } from "@/lib/format"
import { totalUsageFromRuns } from "@/lib/billing"
import { useMemo, useState, useEffect, useCallback } from "react"
import { useWorkspaceBilling } from "@/lib/use-workspace-billing"
import type { BillingAccountView } from "@/lib/store"
import { redirectToCheckout } from "@/lib/stripe-client"
import { STRIPE_ENABLED } from "@/lib/stripe-enabled"
import {
  BillingBalanceSkeleton,
  BillingKeysListSkeleton,
} from "@/components/account-panel-skeletons"
import { Button } from "@/components/ui/button"
import { CreditCard, KeyRound, Loader2 } from "lucide-react"
import { isSharedRun } from "@/lib/shared-link-types"
import type { PipelineRun, Project } from "@/lib/types"
import {
  readBillingKeysSnapshot,
  type BillingKeySnapshot,
} from "@/lib/billing-keys-snapshot-cache"
import { fetchBillingKeys } from "@/lib/fetch-billing-keys"
import { readProjectRunsCache, writeProjectRunsCache } from "@/lib/project-state-cache"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { BillingSpendSection } from "@/components/billing-shared"

type ProjectSpendRow = {
  id: string
  name: string
  usageCents: number
  runCount: number
}

function creditHistoryLabel(source: BillingAccountView["creditHistory"][number]["source"]): string {
  if (source === "invoice") return "Subscription renewal"
  if (source === "feedback") return "Feedback reward"
  return "Checkout payment"
}

function formatCreditWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function projectSpendRows(projects: Project[], billingRuns: PipelineRun[]): ProjectSpendRow[] {
  const rows: ProjectSpendRow[] = projects.map((p) => {
    const runs = readProjectRunsCache(p.id)?.runs ?? []
    return {
      id: p.id,
      name: p.name,
      usageCents: totalUsageFromRuns(runs),
      runCount: runs.length,
    }
  })
  const sharedRuns = billingRuns.filter((run) => isSharedRun(run))
  if (sharedRuns.length) {
    rows.push({
      id: "__shared__",
      name: "Shared pipelines",
      usageCents: totalUsageFromRuns(sharedRuns),
      runCount: sharedRuns.length,
    })
  }
  return rows.sort((a, b) => b.usageCents - a.usageCents)
}

export function AccountBilling() {
  useMarkPrimarySectionReady(AppPrimarySection.Billing)
  const { billingRuns, projects, billingAccount, refreshBilling, refreshBillingRuns } = useWorkspaceBilling()
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [billingKeys, setBillingKeys] = useState<BillingKeySnapshot[]>(
    () => readBillingKeysSnapshot() ?? [],
  )
  const [billingKeysBusy, setBillingKeysBusy] = useState(false)
  const [billingKeysError, setBillingKeysError] = useState<string | null>(null)
  const [newBillingKey, setNewBillingKey] = useState<string | null>(null)
  const [projectRunsVersion, setProjectRunsVersion] = useState(0)

  useEffect(() => {
    void refreshBillingRuns().catch(console.error)
  }, [refreshBillingRuns])

  // AI : warm per-project run caches so the breakdown table can attribute spend.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const missing = projects.filter((p) => !readProjectRunsCache(p.id))
      if (!missing.length) return
      await Promise.all(
        missing.map(async (p) => {
          try {
            const data = await apiJson<{ runs: PipelineRun[] }>(
              `${API_ROUTES.runs}?projectId=${encodeURIComponent(p.id)}`,
            )
            writeProjectRunsCache(p.id, data.runs)
          } catch {
            // AI : leave row at zero — user can open the project to retry.
          }
        }),
      )
      if (!cancelled) setProjectRunsVersion((v) => v + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [projects])

  const spendByProject = useMemo(
    () => projectSpendRows(projects, billingRuns),
    [projects, billingRuns, projectRunsVersion],
  )

  async function startCheckout(mode: "payment" | "subscription", amountCents?: number) {
    const key = mode === "subscription" ? "subscription" : `topup:${amountCents}`
    setCheckoutKey(key)
    setBanner(null)
    try {
      const res = await fetch(API_ROUTES.billingCheckout, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ mode, amountCents }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Checkout failed")
      if (!body.url) throw new Error("Checkout session missing redirect URL")
      redirectToCheckout(body.url)
    } catch (e) {
      setBanner((e as Error).message)
      setCheckoutKey(null)
    }
  }

  const loadBillingKeys = useCallback(async (opts?: { force?: boolean }) => {
    const cached = readBillingKeysSnapshot()
    if (cached) setBillingKeys(cached)
    setBillingKeysBusy(opts?.force === true || !cached?.length)
    try {
      const { keys, error } = await fetchBillingKeys(opts)
      setBillingKeys(keys)
      setBillingKeysError(error)
    } finally {
      setBillingKeysBusy(false)
    }
  }, [])

  useEffect(() => {
    void loadBillingKeys()
  }, [loadBillingKeys])

  async function createBillingKey() {
    setBillingKeysBusy(true)
    setNewBillingKey(null)
    try {
      const data = await apiJson<{ key: { key: string } }>(API_ROUTES.billingKeys, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ label: "default" }),
      })
      setNewBillingKey(data.key.key)
      await loadBillingKeys({ force: true })
    } catch (e) {
      setBanner((e as Error).message)
    } finally {
      setBillingKeysBusy(false)
    }
  }

  const minRunBalanceCents = billingAccount?.minRunBalanceCents ?? MIN_RUN_BALANCE_CENTS
  const capReached = billingAccount
    ? billingAccount.totalBilledCents >= billingAccount.billingCapCents
    : false
  const canRun = billingAccount ? billingAccount.balanceCents >= minRunBalanceCents : false

  return (
    <div className="flex h-full flex-col">
      {billingAccount ? (
        <div className="relative z-10 shrink-0 border-b border-border bg-card px-5 py-4">
          {banner ? (
            <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {banner}
            </p>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Credit balance</p>
              <p className="font-mono text-3xl font-semibold">{formatCents(billingAccount.balanceCents)}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {formatCents(minRunBalanceCents)} minimum to run · paid{" "}
                {formatCents(billingAccount.totalBilledCents)} of{" "}
                {formatCents(billingAccount.billingCapCents)} cap
                {capReached ? " — cap reached" : ""}
              </p>
            </div>
            <div className="relative z-10 flex flex-wrap gap-2">
              {STRIPE_ENABLED ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!!checkoutKey || billingAccount.subscribed || capReached}
                    onClick={() => startCheckout("subscription")}
                    spineId="billing.subscribe"
                  >
                    {checkoutKey === "subscription" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5" />
                    )}
                    {billingAccount.subscribed
                      ? `Subscribed — ${formatCents(billingAccount.subCentsPerMonth)}/mo`
                      : `Subscribe ${formatCents(billingAccount.subCentsPerMonth)}/mo`}
                  </Button>
                  {billingAccount.topupOptionsCents.map((amountCents) => {
                    const topupKey = `topup:${amountCents}`
                    const topupCapReached =
                      billingAccount.totalBilledCents + amountCents > billingAccount.billingCapCents
                    return (
                      <Button
                        key={amountCents}
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={!!checkoutKey || capReached || topupCapReached}
                        onClick={() => startCheckout("payment", amountCents)}
                        spineId="billing.topup"
                      >
                        {checkoutKey === topupKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Top up {formatCents(amountCents)}
                      </Button>
                    )
                  })}
                </>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refreshBilling({ force: true }).catch(console.error)}
                spineId="billing.refresh"
              >
                Refresh
              </Button>
            </div>
          </div>
          {!canRun ? (
            <p className="mt-3 font-mono text-[10px] text-amber-600 dark:text-amber-400">
              Not enough credit to run a pipeline — subscribe or top up.
            </p>
          ) : null}
        </div>
      ) : (
        <BillingBalanceSkeleton />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="shrink-0 border-b border-border bg-card">
          <div className="border-b border-border px-5 py-2.5">
            <h3 className="text-sm font-medium">Spend by project</h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              Per-pipeline totals from run history · shared links listed separately
            </p>
          </div>
          {spendByProject.length ? (
            <ul className="divide-y divide-border">
              {spendByProject.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {row.runCount} run{row.runCount === 1 ? "" : "s"}
                  </span>
                  <span className="w-20 text-right font-mono text-xs">{formatCents(row.usageCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 font-mono text-xs text-muted-foreground">No billed runs yet.</p>
          )}
        </div>

        <BillingSpendSection runs={billingRuns} scopeLabel="All projects" chartScope="all" embedded />

        <div className="p-5">
        <div className="rounded-lg border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div>
              <h3 className="text-sm font-medium">Billing API keys</h3>
              <p className="font-mono text-[10px] text-muted-foreground">
                For caller-paid hosted APIs — pass as X-Spine-Billing-Key
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={billingKeysBusy}
              onClick={() => void createBillingKey()}
              spineId="billing.create-key"
            >
              {billingKeysBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Create key
            </Button>
          </div>
          {newBillingKey ? (
            <div className="border-b border-border bg-amber-500/10 px-4 py-3">
              <p className="mb-1 text-xs text-amber-900 dark:text-amber-100">Copy now — shown once</p>
              <code className="block truncate font-mono text-[10px]">{newBillingKey}</code>
            </div>
          ) : null}
          {billingKeysError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-destructive/10 px-4 py-3">
              <p className="font-mono text-xs text-destructive">{billingKeysError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={billingKeysBusy}
                onClick={() => void loadBillingKeys({ force: true })}
                spineId="billing.refresh-keys"
              >
                {billingKeysBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Retry
              </Button>
            </div>
          ) : null}
          {billingKeysBusy && !billingKeys.length ? (
            <BillingKeysListSkeleton />
          ) : billingKeys.length ? (
            <ul className="divide-y divide-border">
              {billingKeys.map((k) => (
                <li key={k.id} className="flex items-center gap-3 px-4 py-2.5 font-mono text-xs">
                  <span className="min-w-0 flex-1 truncate">{k.label}</span>
                  <span className="text-[10px] text-muted-foreground">{k.keyPrefix}…</span>
                </li>
              ))}
            </ul>
          ) : billingKeysError ? null : (
            <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
              No billing keys — create one to call billable APIs programmatically.
            </p>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-medium">Credit history</h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              Paid top-ups and subscription credits · welcome {formatCents(billingAccount?.freeCreditCents ?? 0)} not listed
            </p>
          </div>
          {billingAccount?.creditHistory.length ? (
            <ul className="divide-y divide-border">
              {billingAccount.creditHistory.map((entry) => (
                <li key={entry.creditKey} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-36 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatCreditWhen(entry.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-xs">{creditHistoryLabel(entry.source)}</span>
                  <span className="font-mono text-xs text-primary">+{formatCents(entry.amountCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
              No paid credits yet — top up or subscribe to see entries here.
            </p>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
