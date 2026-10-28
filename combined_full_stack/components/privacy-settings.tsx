"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { LEGAL, LEGAL_ROUTES } from "@shared/legal/site"
import { LegalFooterLinks } from "@/lib/legal/chrome"
import { PrivacyMarketingSkeleton } from "@/components/account-panel-skeletons"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isDemoMode } from "@/lib/demo-mode"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session"
import {
  fetchSettingsAccount,
  patchSettingsAccountMarketingOptIn,
} from "@/lib/warm-settings-data"
import { readSettingsAccountSnapshot } from "@/lib/settings-account-snapshot-cache"

export function PrivacySettings() {
  const [marketingOptIn, setMarketingOptIn] = useState(
    () => readSettingsAccountSnapshot()?.marketingOptIn ?? false,
  )
  const [email, setEmail] = useState<string | null>(
    () => readSettingsAccountSnapshot()?.email ?? null,
  )
  const [loading, setLoading] = useState(() => readSettingsAccountSnapshot() == null)
  const [saving, setSaving] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const emailMatches =
    !!email && confirmEmail.trim().toLowerCase() === email.trim().toLowerCase()
  const canDelete = emailMatches && !deleting && !isDemoMode()

  useEffect(() => {
    if (isDemoMode()) {
      setLoading(false)
      return
    }
    void fetchSettingsAccount()
      .then((account) => {
        setMarketingOptIn(account.marketingOptIn)
        setEmail(account.email)
      })
      .finally(() => setLoading(false))
  }, [])

  async function toggleMarketing(checked: boolean) {
    if (isDemoMode()) return
    setSaving(true)
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.updateUser({
        data: { marketing_opt_in: checked },
      })
      if (!error) {
        setMarketingOptIn(checked)
        patchSettingsAccountMarketingOptIn(checked)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (!canDelete || !email) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await apiJson<{ ok: true }>(API_ROUTES.account, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      })
      clearWorkspaceClientSession()
      window.location.href = "/login"
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account")
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Privacy &amp; data</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Policies, marketing preferences, and data subject requests.
          </p>
        </div>
        <div className="space-y-4 px-4 py-3">
          <LegalFooterLinks linkClassName="text-xs text-primary underline-offset-2 hover:underline" />
          {loading ? (
            <PrivacyMarketingSkeleton />
          ) : (
            <label className="flex cursor-pointer items-start gap-3">
              <Switch
                checked={marketingOptIn}
                disabled={saving || isDemoMode()}
                onCheckedChange={(checked) => void toggleMarketing(!!checked)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Marketing emails</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Product updates only — withdraw any time. Service emails may still be sent.
                </span>
              </span>
            </label>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            To access, export, or correct your data, email{" "}
            <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary underline underline-offset-2">
              {LEGAL.contactEmail}
            </a>
            . We respond within one month. Policy version: {LEGAL.policyVersion}.
          </p>
          <p className="text-xs text-muted-foreground">
            <Link href={LEGAL_ROUTES.cookies} className="underline underline-offset-2 hover:text-foreground">
              Manage cookie preferences
            </Link>
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-destructive/40 bg-card">
        <div className="border-b border-destructive/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">Delete account</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanently delete your account, projects, documents, runs, and billing balance. This cannot be
            undone.
          </p>
        </div>
        <div className="space-y-4 px-4 py-4">
          {isDemoMode() ? (
            <p className="text-xs text-muted-foreground">Account deletion is unavailable in preview mode.</p>
          ) : !email ? (
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading account…" : "Sign in with an email account to enable deletion."}
            </p>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  Type <span className="font-medium text-foreground">{email}</span> to confirm
                </span>
                <Input
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={email}
                  autoComplete="off"
                  spellCheck={false}
                  className="max-w-md"
                />
              </label>
              {deleteError ? (
                <p className="text-xs text-destructive" role="alert">
                  {deleteError}
                </p>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!canDelete}
                onClick={() => void handleDeleteAccount()}
              >
                {deleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Delete my account
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
