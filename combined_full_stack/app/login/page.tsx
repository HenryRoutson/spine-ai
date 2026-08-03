"use client"

// AI : todo §7 — email/password via server actions (GitHub/Google OAuth commented out for now).
// AI : TODO (spec) — re-enable GitHub/Google OAuth sign-in (callback route exists at /auth/callback).
// AI : A signed-in session makes every API route open the per-user SupabaseStore.

import { useActionState, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// import { Separator } from "@/components/ui/separator"
import { authAction, type AuthActionState } from "@/app/login/actions"
import type { AuthMode } from "@/utils/supabase/auth_messages"
import { SignupConsents } from "@/components/signup-consents"
import { LegalFooterLinks } from "@/lib/legal/chrome"
import { SpineLogoBox } from "@/components/spine-mark"
import { LEGAL } from "@/lib/shared/legal/site"
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session"
import { sanitizeRedirectPath } from "@/utils/sanitize_redirect"

// type OAuthProvider = "github" | "google"

// function GitHubIcon() {
//   return (
//     <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
//       <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
//     </svg>
//   )
// }

// function GoogleIcon() {
//   return (
//     <svg viewBox="0 0 24 24" aria-hidden="true">
//       <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
//       <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
//       <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
//       <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
//     </svg>
//   )
// }

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [nextPath, setNextPath] = useState("/projects")
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    authAction,
    null,
  )
  const [urlError, setUrlError] = useState<string | null>(null)
  // const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null)

  useEffect(() => {
    clearWorkspaceClientSession()
    const params = new URLSearchParams(window.location.search)
    if (params.get("error") === "auth")
      setUrlError("Sign in failed — please try again.")
    const next = params.get("next")
    setNextPath(next ? sanitizeRedirectPath(next) : "/projects")
  }, [])

  // async function signInWithOAuth(provider: OAuthProvider) {
  //   setOauthBusy(provider)
  //   const supabase = await createClient()
  //   const { error } = await supabase.auth.signInWithOAuth({
  //     provider,
  //     options: {
  //       redirectTo: `${getSiteUrl()}/auth/callback`,
  //     },
  //   })
  //   if (error) setOauthBusy(null)
  // }

  const error = state?.error ?? urlError
  const notice = state?.notice ?? null

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6" id="main-content">
        <div className="mb-5 flex items-center gap-2.5">
          <SpineLogoBox />
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight">{LEGAL.productName}</h1>
            <p className="font-mono text-[10px] text-muted-foreground">
              {mode === "sign-in" ? "sign in to your workspace" : "create an account"}
            </p>
          </div>
        </div>

        {/* <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!!oauthBusy || pending}
            onClick={() => signInWithOAuth("github")}
            className="w-full gap-2"
          >
            <GitHubIcon />
            {oauthBusy === "github" ? "…" : "Continue with GitHub"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!oauthBusy || pending}
            onClick={() => signInWithOAuth("google")}
            className="w-full gap-2"
          >
            <GoogleIcon />
            {oauthBusy === "google" ? "…" : "Continue with Google"}
          </Button>
        </div>

        <div className="my-4 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="font-mono text-[10px] text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div> */}

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="next" value={nextPath} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              placeholder="••••••••"
            />
          </div>

          {mode === "sign-up" ? <SignupConsents disabled={pending} /> : null}

          {notice && <p className="text-xs text-primary">{notice}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={pending} className="mt-1 w-full">
            {pending ? "…" : mode === "sign-in" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in")
              setUrlError(null)
            }}
            className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {mode === "sign-in" ? "need an account? sign up" : "have an account? sign in"}
          </button>
        </div>
      </div>
      <footer className="mt-6">
        <LegalFooterLinks
          linkClassName="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        />
      </footer>
    </div>
  )
}
