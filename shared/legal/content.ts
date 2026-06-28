// AI : TODO refactor — duplicate of `combined_full_stack/lib/legal/content.ts`; consolidate via shared import.
import { LEGAL } from "./site"

export type LegalSection = {
  id: string
  title: string
  body: string[]
  bullets?: string[]
}

export const LEGAL_DISCLAIMER =
  "This document is provided for transparency and is not legal advice. Engage qualified counsel before relying on it for compliance decisions."

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "controller",
    title: "Who we are",
    body: [
      `${LEGAL.controllerName} operates ${LEGAL.productName}. For privacy questions contact ${LEGAL.contactEmail}.`,
      "We do not currently appoint a Data Protection Officer. We will publish one if required by law.",
    ],
  },
  {
    id: "data-we-collect",
    title: "What we collect",
    body: [
      "Account data: email address and authentication credentials (hashed by our auth provider).",
      "Product data: pipelines, documents you upload, inference runs, logs, billing metadata, and feedback you submit.",
      "Technical data: essential session cookies, IP address, and request logs needed to operate and secure the service.",
    ],
    bullets: [
      "We do not require health, biometric, or children's data to use the core product.",
      "If you upload special-category data (e.g. health or legal documents), you are responsible for having a lawful basis to do so.",
    ],
  },
  {
    id: "purposes",
    title: "Why we process data",
    body: ["We process personal data only for the purposes below."],
    bullets: [
      "Provide and secure the service (contract / legitimate interests).",
      "Authenticate users and prevent abuse (legitimate interests).",
      "Process payments via Stripe (contract).",
      "Send service emails such as confirmations and security notices (contract / legitimate interests).",
      "Send marketing only if you opt in (consent — withdraw any time in Settings or by emailing us).",
      "Improve reliability and debug issues using aggregated diagnostics (legitimate interests).",
    ],
  },
  {
    id: "processors",
    title: "Sub-processors",
    body: [
      "We use vetted vendors that process data on our behalf under data-processing terms where required.",
    ],
    bullets: [
      "Supabase — authentication and database hosting.",
      "Stripe — payment processing (card data is handled by Stripe; we do not store full card numbers).",
      "OpenRouter / model providers — LLM inference when you run pipelines (prompts and outputs you send).",
      "Vercel — application hosting and delivery.",
    ],
  },
  {
    id: "transfers",
    title: "International transfers",
    body: [
      "Some providers may process data in the United States or other countries outside your region.",
      "Where required, we rely on appropriate safeguards such as Standard Contractual Clauses and vendor DPAs.",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    body: [
      "We keep account and project data while your account is active.",
      "After account deletion we remove or anonymise personal data within 30 days, except where law requires longer retention (e.g. billing records).",
      "Cached inference results may be deleted sooner via cache controls in the product.",
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    body: [
      "Depending on your location you may have rights to access, correct, delete, restrict, port, or object to processing.",
      `Email ${LEGAL.contactEmail} to exercise these rights. We respond within one month.`,
      "You may lodge a complaint with your local supervisory authority.",
    ],
  },
  {
    id: "automated",
    title: "Automated processing & AI",
    body: [
      "The product runs LLM-based pipeline steps you configure. Outputs are not professional advice.",
      "We do not make solely automated decisions with legal or similarly significant effects about you.",
      "Human reviewers should verify outputs before relying on them, especially for legal, medical, or financial use cases.",
    ],
  },
]

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: [
      `By creating an account or using ${LEGAL.productName}, you agree to these Terms of Service (version ${LEGAL.policyVersion}).`,
      "If you do not agree, do not use the service.",
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    body: [
      `You must be at least ${LEGAL.minAgeYears} years old, or the age of digital consent in your country if higher.`,
      "You must provide accurate registration information and keep your credentials secure.",
    ],
  },
  {
    id: "service",
    title: "The service",
    body: [
      `${LEGAL.productName} is a pipeline builder for structured LLM workflows — provided as-is during early access.`,
      "We may change, suspend, or discontinue features with reasonable notice where practicable.",
    ],
  },
  {
    id: "your-content",
    title: "Your content",
    body: [
      "You retain ownership of documents and pipelines you upload or create.",
      "You grant us a limited licence to host, process, and display your content solely to operate the service.",
      "You must not upload unlawful content or data you lack rights to use.",
    ],
    bullets: [
      "Do not use the service to provide regulated medical, legal, or financial advice without appropriate licences and human oversight.",
      "AI outputs may be inaccurate — verify before acting.",
    ],
  },
  {
    id: "billing",
    title: "Billing & cancellation",
    body: [
      "Paid features are billed through Stripe. Prices shown at checkout apply.",
      "You may stop using the service and cancel subscriptions through Billing. No dark-pattern flows — cancellation is as easy as signup.",
      "Refund terms follow applicable consumer law and what we display at purchase.",
    ],
  },
  {
    id: "liability",
    title: "Liability",
    body: [
      "To the maximum extent permitted by law, we are not liable for indirect or consequential damages, or for decisions made based on model outputs.",
      "Nothing limits liability where it cannot be limited by law (e.g. death, personal injury, fraud).",
      "Consumers retain mandatory rights under their local law.",
    ],
  },
  {
    id: "law",
    title: "Governing law",
    body: [
      "These terms are governed by the laws of England and Wales, without prejudice to mandatory consumer protections in your country of residence.",
    ],
  },
]

export const COOKIE_SECTIONS: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    body: [
      "We use cookies and similar technologies. Non-essential cookies load only after you consent.",
    ],
  },
  {
    id: "essential",
    title: "Strictly necessary",
    body: ["Required for login, security, and shared inference links."],
    bullets: [
      "Authentication session — keeps you signed in.",
      "shared_run_session — anonymous session for shared run pages.",
      "cookie_consent — remembers your cookie choice.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics (optional)",
    body: [
      "We do not currently load third-party analytics scripts.",
      "If we add analytics later, they will load only after you opt in via the cookie banner.",
    ],
  },
  {
    id: "manage",
    title: "Managing cookies",
    body: [
      "Use the cookie banner or clear site data in your browser to withdraw consent.",
      "Blocking essential cookies may prevent the app from working.",
    ],
  },
]

export const ACCESSIBILITY_SECTIONS: LegalSection[] = [
  {
    id: "commitment",
    title: "Our commitment",
    body: [
      `We aim for WCAG 2.2 Level AA conformance for ${LEGAL.productName} and this marketing site.`,
      "Accessibility is ongoing work — we welcome reports of barriers.",
    ],
  },
  {
    id: "measures",
    title: "Measures in place",
    body: ["Current implementations include:"],
    bullets: [
      "Skip link to main content on key pages.",
      "Semantic headings and form labels on auth flows.",
      "Keyboard-focusable controls in the primary UI.",
      "Colour is not the only means of conveying pipeline validity (icons and text are used).",
    ],
  },
  {
    id: "known-issues",
    title: "Known limitations",
    body: [
      "The visual pipeline canvas and some JSON viewers may be difficult with screen readers.",
      "Third-party document previews may not meet our target standard.",
      "We are remediating issues as we find them.",
    ],
  },
  {
    id: "feedback",
    title: "Report an issue",
    body: [
      `Email ${LEGAL.contactEmail} with the page URL and a description of the barrier.`,
      "We aim to respond within 5 business days.",
    ],
  },
]
