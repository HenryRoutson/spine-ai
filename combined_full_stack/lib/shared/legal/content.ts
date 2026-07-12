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
      "Early-access diagnostics: while the product is in early access we may log signed-in usage events to help us fix bugs — including buttons you click, text you type into form fields (up to 2,000 characters per field), tab navigation, pipeline step changes, log views, LLM call metadata, and error messages shown in the app. This is disclosed here and in our Terms; we use it only to operate and improve reliability, not for advertising.",
      "Technical data: essential session cookies, IP address, and request logs needed to operate and secure the service.",
      "Landing page demo (no account required): the full text of the automation task you submit, a short preview of the generated pipeline message, model and token-usage metadata, build identifiers, a one-way hash of your IP address for abuse prevention, and — after you accept the demo privacy banner — a session replay recording of the landing page (DOM mutations, clicks, and typed text via rrweb) so we can debug demo failures.",
    ],
    bullets: [
      "We do not require health, biometric, or children's data to use the core product or the public demo.",
      "Do not enter personal, confidential, or special-category data (e.g. health, legal, or financial records) into the landing page demo — it is logged and sent to an LLM provider to generate a preview.",
      "If you upload special-category data to a signed-in account (e.g. health or legal documents), you are responsible for having a lawful basis to do so.",
    ],
  },
  {
    id: "purposes",
    title: "Why we process data",
    body: ["We process personal data only for the purposes below."],
    bullets: [
      "Provide and secure the service (contract / legitimate interests).",
      "Authenticate users and prevent abuse (legitimate interests).",
      "Operate the public landing page demo, enforce rate limits, and maintain a separate demo budget (legitimate interests).",
      "Process payments via Stripe (contract).",
      "Send service emails such as confirmations and security notices (contract / legitimate interests).",
      "Send marketing only if you opt in (consent — withdraw any time in Settings or by emailing us).",
      "Improve reliability, understand common demo use cases, and debug issues using aggregated diagnostics (legitimate interests).",
      "During early access, record per-user activity timelines and billing flow for operator debugging when you use a signed-in account (legitimate interests — see What we collect).",
      "Record landing-page session replays after demo privacy consent to diagnose demo UX and pipeline-build failures (consent / legitimate interests).",
    ],
  },
  {
    id: "landing-demo",
    title: "Landing page demo",
    body: [
      `The marketing site at ${LEGAL.productName} lets visitors describe an automation task and receive a generated pipeline preview without creating an account.`,
      "When you use this demo we record your submitted task (up to 2,000 characters), the model response summary, pipeline name, build identifier, token counts, estimated cost, latency, and a salted hash of your IP address.",
      "After you accept the demo privacy banner we also record a session replay of the landing page using rrweb (page structure, clicks, scrolls, and form input — passwords are masked). Replays are stored with your demo email and IP hash so we can reproduce bugs; they are not used for advertising.",
      "Your prompt is transmitted to our LLM inference provider (OpenRouter and the underlying model provider) solely to produce the preview. We do not use landing demo prompts to train our own models.",
      `Before you can click Generate, you must accept via the banner at the bottom of the page confirming you have read this Privacy Policy (version ${LEGAL.policyVersion}) and agree that your task text will be logged and sent to an LLM, and that a session replay may be recorded, as described above.`,
      "Lawful basis: your consent when you click I accept, plus legitimate interests in preventing abuse and maintaining service reliability.",
      "We do not sell landing demo data. We do not use it for advertising profiles.",
    ],
    bullets: [
      "Do not submit passwords, API keys, personal identifiers, or confidential business data.",
      "You must be at least 16 years old (or the age of digital consent in your country, if higher) to use the demo.",
      "To request deletion of a landing demo log entry or session replay, email us with the approximate time of your request and, if possible, the task text or email you submitted.",
    ],
  },
  {
    id: "processors",
    title: "Sub-processors",
    body: [
      "We use vetted vendors that process data on our behalf under data-processing terms where required.",
    ],
    bullets: [
      "Supabase — authentication and database hosting (including landing demo call logs).",
      "Stripe — payment processing (card data is handled by Stripe; we do not store full card numbers).",
      "OpenRouter / model providers — LLM inference when you run pipelines or use the landing demo (prompts and outputs you send).",
      "Upstash — rate-limit counters keyed by IP or session (when configured).",
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
      "Landing demo logs and landing-page session replays are kept for up to 12 months, then deleted or aggregated for statistics. You may request earlier deletion by email.",
      "Early-access usage event logs are kept for up to 12 months, then deleted or aggregated. You may request deletion by emailing us from your account email.",
      "Cached inference results may be deleted sooner via cache controls in the product.",
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    body: [
      "Depending on your location you may have rights to access, correct, delete, restrict, port, or object to processing.",
      "California and other US state residents may have additional rights (e.g. to know, delete, and correct personal information, and to opt out of sale or sharing — we do not sell personal data).",
      `Email ${LEGAL.contactEmail} to exercise these rights. We respond within one month (or the shorter period required by applicable law).`,
      "You may lodge a complaint with your local supervisory authority.",
    ],
  },
  {
    id: "automated",
    title: "Automated processing & AI",
    body: [
      "The product runs LLM-based pipeline steps you configure. Outputs are not professional advice.",
      "The landing page demo uses the same class of automated LLM processing to generate a preview pipeline from your typed task.",
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
      `By creating an account, using the public landing page demo, or otherwise using ${LEGAL.productName}, you agree to these Terms of Service (version ${LEGAL.policyVersion}).`,
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
    id: "landing-demo",
    title: "Landing page demo",
    body: [
      "The public demo on our marketing site generates a pipeline preview from text you submit. It does not create an account or grant production access.",
      "Demo submissions are logged as described in our Privacy Policy. Do not enter confidential or personal data.",
      "Demo output is illustrative only — verify before use in production workflows.",
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
    body: ["Required for login, security, shared inference links, and remembering cookie choices."],
    bullets: [
      "Authentication session — keeps you signed in.",
      "shared_run_session — anonymous session for shared run pages.",
      "cookie_consent — remembers your cookie choice.",
    ],
  },
  {
    id: "server-logs",
    title: "Server-side processing (not cookies)",
    body: [
      "Some features — including the landing page demo and rate limiting — process IP addresses and request metadata on our servers without storing them in browser cookies.",
      "See our Privacy Policy for details and your rights.",
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
