import Link from "next/link"
import { LegalDocument } from "@/lib/legal/legal-document"
import { ACCESSIBILITY_SECTIONS } from "@shared/legal/content"
import { LegalPageShell } from "@/components/legal-page-shell"

export const metadata = {
  title: "Accessibility — Spine",
}

export default function AccessibilityPage() {
  return (
    <LegalPageShell>
      <LegalDocument title="Accessibility Statement" sections={ACCESSIBILITY_SECTIONS} />
      <p className="mt-8 text-sm text-muted">
        <Link href="/" className="underline underline-offset-2 hover:text-foreground">
          Back to home
        </Link>
      </p>
    </LegalPageShell>
  )
}
