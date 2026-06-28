import Link from "next/link"
import { LegalDocument } from "@/lib/legal/legal-document"
import { COOKIE_SECTIONS } from "@/lib/legal/content"
import { LegalPageShell } from "@/components/legal-page-shell"
import { CookiePreferences } from "@/components/cookie-preferences"

export const metadata = {
  title: "Cookie Policy — auto pipeline",
}

export default function CookiesPage() {
  return (
    <LegalPageShell>
      <LegalDocument title="Cookie Policy" sections={COOKIE_SECTIONS} />
      <CookiePreferences />
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </LegalPageShell>
  )
}
