import Link from "next/link"
import { LEGAL_ROUTES } from "@/lib/legal/site"

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-current focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
    >
      Skip to main content
    </a>
  )
}

type LegalFooterLinksProps = {
  className?: string
  linkClassName?: string
}

const LINKS = [
  { href: LEGAL_ROUTES.privacy, label: "Privacy" },
  { href: LEGAL_ROUTES.terms, label: "Terms" },
  { href: LEGAL_ROUTES.cookies, label: "Cookies" },
  { href: LEGAL_ROUTES.accessibility, label: "Accessibility" },
] as const

export function LegalFooterLinks({ className, linkClassName }: LegalFooterLinksProps) {
  return (
    <nav aria-label="Legal" className={className}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClassName}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
