"use client"

import { useEffect, useState } from "react"
import {
  readCookieConsent,
  writeCookieConsent,
  type cookie_consent_choice,
} from "@/lib/legal/cookie-consent"

export function CookiePreferences() {
  const [choice, setChoice] = useState<cookie_consent_choice | null>(null)

  useEffect(() => {
    setChoice(readCookieConsent())
  }, [])

  function update(next: cookie_consent_choice) {
    writeCookieConsent(next)
    setChoice(next)
  }

  return (
    <section className="mt-8 border border-line p-4">
      <h2 className="text-sm font-medium">Your cookie preference</h2>
      <p className="mt-2 text-sm text-muted">Current choice: {choice ?? "not set"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="zeero-btn-ghost text-xs" onClick={() => update("essential_only")}>
          Essential only
        </button>
        <button type="button" className="zeero-btn text-xs" onClick={() => update("all")}>
          Accept all
        </button>
      </div>
    </section>
  )
}
