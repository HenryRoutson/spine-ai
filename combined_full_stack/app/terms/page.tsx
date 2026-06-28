import Link from "next/link"
import { LegalDocument } from "@/lib/legal/legal-document"
import { TERMS_SECTIONS } from "@/lib/legal/content"
import { LegalPageShell } from "@/components/legal-page-shell"

export const metadata = {
  title: "Terms of Service — auto pipeline",
}

export default function TermsPage() {
  return (
    <LegalPageShell>
      <LegalDocument title="Terms of Service" sections={TERMS_SECTIONS} />
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </LegalPageShell>
  )
}
