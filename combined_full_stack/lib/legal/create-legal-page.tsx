import Link from "next/link"
import type { Metadata } from "next"
import type { ReactNode } from "react"
import { LegalDocument } from "@/lib/legal/legal-document"
import type { LegalSection } from "@shared/legal/content"
import { LegalPageShell } from "@/components/legal-page-shell"

type legal_page_config = {
  metadataTitle: string
  documentTitle: string
  sections: LegalSection[]
  extra?: ReactNode
}

// AI : shared template for privacy / terms / cookies / accessibility routes.
export function createLegalPage({
  metadataTitle,
  documentTitle,
  sections,
  extra,
}: legal_page_config): { metadata: Metadata; Page: () => ReactNode } {
  const metadata: Metadata = { title: metadataTitle }
  function Page() {
    return (
      <LegalPageShell>
        <LegalDocument title={documentTitle} sections={sections} />
        {extra}
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </LegalPageShell>
    )
  }
  return { metadata, Page }
}
