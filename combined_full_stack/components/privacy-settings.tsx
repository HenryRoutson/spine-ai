"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { LEGAL, LEGAL_ROUTES } from "@/lib/legal/site"
import { LegalFooterLinks } from "@/lib/legal/chrome"
import { Switch } from "@/components/ui/switch"

export function PrivacySettings() {
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void createClient()
      .then((supabase) => supabase.auth.getUser())
      .then(({ data }) => {
        setMarketingOptIn(data.user?.user_metadata?.marketing_opt_in === true)
      })
      .finally(() => setLoading(false))
  }, [])

  async function toggleMarketing(checked: boolean) {
    setSaving(true)
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.updateUser({
        data: { marketing_opt_in: checked },
      })
      if (!error) setMarketingOptIn(checked)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Privacy &amp; data</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Policies, marketing preferences, and data subject requests.
        </p>
      </div>
      <div className="space-y-4 px-4 py-3">
        <LegalFooterLinks linkClassName="text-xs text-primary underline-offset-2 hover:underline" />
        <label className="flex cursor-pointer items-start gap-3">
          <Switch
            checked={marketingOptIn}
            disabled={loading || saving}
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
        <p className="text-xs leading-relaxed text-muted-foreground">
          To access, export, correct, or delete your data, email{" "}
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
  )
}
