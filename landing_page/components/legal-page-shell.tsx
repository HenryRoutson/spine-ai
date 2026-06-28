import { SkipLink, LegalFooterLinks } from "@/lib/legal/chrome"
import { CookieConsentBanner } from "@/lib/legal/cookie-consent"

export function LegalPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grain-bg min-h-screen flex flex-col">
      <SkipLink />
      <div className="mx-auto w-full max-w-[1200px] flex-1 border-x border-line px-8 py-12 sm:px-12" id="main-content">
        {children}
        <footer className="mt-12 border-t border-line pt-6">
          <LegalFooterLinks linkClassName="text-sm text-muted hover:text-foreground" />
        </footer>
      </div>
      <CookieConsentBanner
        panelClassName="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-background/95 p-4 backdrop-blur-sm"
        acceptClassName="zeero-btn text-xs"
        rejectClassName="zeero-btn-ghost text-xs"
      />
    </main>
  )
}
