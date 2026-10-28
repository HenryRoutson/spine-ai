import { SkipLink, LegalFooterLinks } from "@/lib/legal/chrome"
import { CookieConsentBanner } from "@/lib/legal/cookie-consent"

export function LegalPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SkipLink />
      <div className="mx-auto max-w-2xl px-6 py-12" id="main-content">
        {children}
        <footer className="mt-12 border-t border-border pt-6">
          <LegalFooterLinks
            linkClassName="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          />
        </footer>
      </div>
      <CookieConsentBanner />
    </div>
  )
}
