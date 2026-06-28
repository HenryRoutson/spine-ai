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
    <section className="mt-8 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium">Your cookie preference</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Current choice: {choice ?? "not set"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          onClick={() => update("essential_only")}
        >
          Essential only
        </button>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
          onClick={() => update("all")}
        >
          Accept all
        </button>
      </div>
    </section>
  )
}
