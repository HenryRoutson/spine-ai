"use client"
// AI : hosted-page auth — isolated project when allocated; otherwise Spine cookies.

import { useActionState, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SignupConsents } from "@/components/signup-consents"
import { LegalFooterLinks } from "@/lib/legal/chrome"
import { authAction, type AuthActionState } from "@/app/login/actions"
import { isolatedSiteAuthReady } from "@/lib/website-supabase-need"
import type { HostedSiteAuth } from "@/lib/shared-link-types"
import { LEGAL } from "@shared/legal/site"
import { authErrorMessage, type AuthMode } from "@/utils/supabase/auth_messages"

export function HostedSiteSignInCard({
  companyName,
  nextPath,
  auth,
  preview = false,
}: {
  companyName: string
  nextPath: string
  auth: HostedSiteAuth
  preview?: boolean
}) {
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(authAction, null)
  const [isolatedState, setIsolatedState] = useState<AuthActionState>(null)
  const [isolatedPending, setIsolatedPending] = useState(false)
  const name = companyName.trim() || "this workspace"
  const isolated = isolatedSiteAuthReady(auth)
  const disabled = preview || pending || isolatedPending

  if (!preview && auth.allocStatus === "pending") {
    return (
      <div className="hs-auth-card">
        <p className="hs-auth-note">This website&apos;s database is still being created. Sign-in will use that project when it is ready.</p>
      </div>
    )
  }
  if (!preview && auth.allocStatus === "error") {
    return (
      <div className="hs-auth-card">
        <p className="hs-auth-note">{auth.allocError || "Could not create an isolated Supabase for this website."}</p>
      </div>
    )
  }

  async function isolatedSubmit(form: FormData) {
    setIsolatedState(null)
    setIsolatedPending(true)
    try {
      const email = String(form.get("email") ?? "")
      const password = String(form.get("password") ?? "")
      const sb = createBrowserClient(auth.customSupabaseUrl, auth.customSupabaseAnonKey, {
        auth: { persistSession: true, storageKey: `spine-site:${auth.customSupabaseUrl}` },
      })
      if (mode === "sign-in") {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) {
          setIsolatedState({ error: authErrorMessage(error, mode) })
          return
        }
        window.location.assign(nextPath)
        return
      }
      if (form.get("age_confirmed") !== "yes") {
        setIsolatedState({ error: `You must confirm you are at least ${LEGAL.minAgeYears} years old.` })
        return
      }
      if (form.get("accept_terms") !== "yes") {
        setIsolatedState({ error: "You must accept the Terms of Service." })
        return
      }
      if (form.get("accept_privacy") !== "yes") {
        setIsolatedState({ error: "You must confirm you have read the Privacy Policy." })
        return
      }
      const { data, error } = await sb.auth.signUp({ email, password })
      if (error) {
        setIsolatedState({ error: authErrorMessage(error, mode) })
        return
      }
      if (data.user && data.user.identities?.length === 0) {
        setIsolatedState({ error: "An account with this email already exists — sign in instead." })
        return
      }
      if (data.session) {
        window.location.assign(nextPath)
        return
      }
      setIsolatedState({ notice: "Account created — check your email for a confirmation link, then sign in." })
    } finally {
      setIsolatedPending(false)
    }
  }

  const shown = isolated ? isolatedState : state

  return (
    <div className="hs-auth-card">
      {isolated ? (
        <p className="hs-auth-note">Sign-in for this website uses its own Supabase project — not the Spine app.</p>
      ) : auth.provider === "custom_supabase" ? (
        <p className="hs-auth-note">
          Bring-your-own keys are stored. Until an isolated project is allocated, visitors still sign in with Spine.
        </p>
      ) : null}
      <form
        action={preview || isolated ? undefined : formAction}
        className="flex flex-col gap-3"
        onSubmit={
          preview
            ? (e) => e.preventDefault()
            : isolated
              ? (e) => {
                  e.preventDefault()
                  void isolatedSubmit(new FormData(e.currentTarget))
                }
              : undefined
        }
      >
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
        {mode === "sign-up" && !preview ? <SignupConsents disabled={pending || isolatedPending} /> : null}
        {shown?.notice ? <p className="text-xs text-primary">{shown.notice}</p> : null}
        {shown?.error ? <p className="text-xs text-destructive">{shown.error}</p> : null}
        <Button type="submit" disabled={disabled} className="mt-1 w-full">
          {pending || isolatedPending ? "…" : mode === "sign-in" ? `Sign in to ${name}` : `Create ${name} account`}
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
