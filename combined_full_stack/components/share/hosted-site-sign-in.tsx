"use client"
// AI : default hosted-page auth — Spine handles sign-in; custom Supabase is stored, not allocated yet.

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SignupConsents } from "@/components/signup-consents"
import { LegalFooterLinks } from "@/lib/legal/chrome"
import { authAction, type AuthActionState } from "@/app/login/actions"
import type { HostedSiteAuthProvider } from "@/lib/shared-link-types"
import type { AuthMode } from "@/utils/supabase/auth_messages"

export function HostedSiteSignInCard({
  companyName,
  nextPath,
  provider,
  preview = false,
}: {
  companyName: string
  nextPath: string
  provider: HostedSiteAuthProvider
  preview?: boolean
}) {
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(authAction, null)
  const custom = provider === "custom_supabase"
  const name = companyName.trim() || "this workspace"
  const disabled = preview || pending

  return (
    <div className="hs-auth-card">
      {custom ? (
        <p className="hs-auth-note">
          Custom sign-in on a separate Supabase is stored here but not used yet. Until we
          provision a project per website, visitors still sign in with Spine. Hosted SQL
          rows live in Spine `app_sql_rows` (scope `site:…`), not this BYO project.
        </p>
      ) : null}
      <form action={preview ? undefined : formAction} className="flex flex-col gap-3" onSubmit={preview ? (e) => e.preventDefault() : undefined}>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={nextPath} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hs-auth-email" className="text-xs">
            Email
          </Label>
          <Input
            id="hs-auth-email"
            name="email"
            type="email"
            required={!preview}
            autoComplete="email"
            placeholder="you@company.com"
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hs-auth-password" className="text-xs">
            Password
          </Label>
          <Input
            id="hs-auth-password"
            name="password"
            type="password"
            required={!preview}
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            placeholder="••••••••"
            disabled={disabled}
          />
        </div>
        {mode === "sign-up" && !preview ? <SignupConsents disabled={pending} /> : null}
        {state?.notice ? <p className="text-xs text-primary">{state.notice}</p> : null}
        {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
        <Button type="submit" disabled={disabled} className="mt-1 w-full">
          {pending ? "…" : mode === "sign-in" ? `Sign in to ${name}` : `Create ${name} account`}
        </Button>
      </form>
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={preview}
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          {mode === "sign-in" ? "need an account? sign up" : "have an account? sign in"}
        </button>
      </div>
      <div className="mt-4">
        <LegalFooterLinks linkClassName="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" />
      </div>
    </div>
  )
}

export function HostedSiteAccountBar({
  email,
  onSignOut,
}: {
  email: string
  onSignOut: () => void
}) {
  return (
    <div className="hs-account">
      <span className="max-w-[16rem] truncate font-mono">{email}</span>
      <button type="button" className="hs-nav-link" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}
