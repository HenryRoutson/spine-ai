import Link from "next/link"
import { LegalDocument } from "@/lib/legal/legal-document"
import { PRIVACY_SECTIONS } from "@/lib/legal/content"
import { LegalPageShell } from "@/components/legal-page-shell"

export const metadata = {
  title: "Privacy Policy — auto pipeline",
}

export default function PrivacyPage() {
  return (
    <LegalPageShell>
      <LegalDocument title="Privacy Policy" sections={PRIVACY_SECTIONS} />
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </LegalPageShell>
  )
}
