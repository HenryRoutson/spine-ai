"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LEGAL_ROUTES } from "@shared/legal/site"

export type cookie_consent_choice = "essential_only" | "all"

const STORAGE_KEY = "cookie_consent_v1"

export function readCookieConsent(): cookie_consent_choice | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === "essential_only" || raw === "all" ? raw : null
}

export function writeCookieConsent(choice: cookie_consent_choice): void {
  localStorage.setItem(STORAGE_KEY, choice)
  document.cookie = `${STORAGE_KEY}=${choice};path=/;max-age=31536000;SameSite=Lax`
}

type CookieConsentBannerProps = {
  acceptClassName?: string
  rejectClassName?: string
  panelClassName?: string
  messageClassName?: string
}

export function CookieConsentBanner({
  acceptClassName = "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground",
  rejectClassName = "rounded-md border px-3 py-1.5 text-xs",
  panelClassName = "fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 p-4 backdrop-blur-sm",
  messageClassName = "text-sm leading-relaxed text-muted-foreground",
}: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.location.pathname.startsWith("/site/")) return
    setVisible(readCookieConsent() === null)
  }, [])

  function choose(choice: cookie_consent_choice) {
    writeCookieConsent(choice)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div role="dialog" aria-label="Cookie consent" className={panelClassName}>
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={messageClassName}>
          We use essential cookies for sign-in and security. Optional analytics are off unless you
          accept. See our{" "}
          <Link href={LEGAL_ROUTES.cookies} className="underline underline-offset-2">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className={rejectClassName} onClick={() => choose("essential_only")}>
            Essential only
          </button>
          <button type="button" className={acceptClassName} onClick={() => choose("all")}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
