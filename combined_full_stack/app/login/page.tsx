"use client"

// AI : todo §7 — email/password via the Supabase browser client (GitHub/Google OAuth commented out for now).
// AI : A signed-in session makes every API route open the per-user SupabaseStore.

import { useState, useEffect, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// import { Separator } from "@/components/ui/separator"
import { createClient } from "@/utils/supabase/client"

type AuthMode = "sign-in" | "sign-up"
// type OAuthProvider = "github" | "google"

function authErrorMessage(error: { message: string; code?: string }, mode: AuthMode): string {
  if (error.code === "invalid_credentials" || error.message === "Invalid login credentials")
    return mode === "sign-in"
      ? "No account with those credentials — sign up first, or check your password."
      : error.message
  if (error.code === "email_address_invalid")
    return "That email address isn't allowed — try a real address (e.g. Gmail)."
  if (error.code === "over_email_send_rate_limit")
    return "Too many sign-up emails sent — wait a few minutes and try again."
  return error.message
}

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
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("error") === "auth")
      setError("Sign in failed — please try again.")
  }, [])

  // async function signInWithOAuth(provider: OAuthProvider) {
  //   setOauthBusy(provider)
  //   setError(null)
  //   setNotice(null)
  //   const supabase = await createClient()
  //   const { error } = await supabase.auth.signInWithOAuth({
  //     provider,
  //     options: {
  //       redirectTo: `${window.location.origin}/auth/callback`,
  //     },
  //   })
  //   if (error) {
  //     setError(error.message)
  //     setOauthBusy(null)
  //   }
  // }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    const supabase = await createClient()

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(authErrorMessage(error, mode))
        setBusy(false)
        return
      }
      window.location.href = "/"
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(authErrorMessage(error, mode))
      setBusy(false)
      return
    }
    // AI : Supabase hides duplicate emails — empty identities means account already exists.
    if (data.user && data.user.identities?.length === 0) {
      setError("An account with this email already exists — sign in instead.")
      setBusy(false)
      return
    }
    if (data.session) {
      window.location.href = "/"
      return
    }
    // AI : email confirmation enabled in Supabase — no session until they click the link.
    setNotice("Account created — check your email for a confirmation link, then sign in.")
    setMode("sign-in")
    setPassword("")
    setBusy(false)
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="font-mono text-sm font-bold">|</span>
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight">auto pipeline</h1>
            <p className="font-mono text-[10px] text-muted-foreground">
              {mode === "sign-in" ? "sign in to your pipelines" : "create an account"}
            </p>
          </div>
        </div>

        {/* <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!!oauthBusy || busy}
            onClick={() => signInWithOAuth("github")}
            className="w-full gap-2"
          >
            <GitHubIcon />
            {oauthBusy === "github" ? "…" : "Continue with GitHub"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!oauthBusy || busy}
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

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {notice && <p className="text-xs text-primary">{notice}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy ? "…" : mode === "sign-in" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in")
              setError(null)
              setNotice(null)
            }}
            className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {mode === "sign-in" ? "need an account? sign up" : "have an account? sign in"}
          </button>
        </div>
      </div>
    </div>
  )
}
