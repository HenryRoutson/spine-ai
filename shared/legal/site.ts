// AI : TODO refactor — duplicate of `combined_full_stack/lib/legal/site.ts`; consolidate via shared import.
export type policy_version_string = string
export type contact_email_string = string

export const LEGAL = {
  productName: "auto pipeline",
  controllerName: "auto pipeline (Antler hackathon project)",
  contactEmail: "privacy@auto-pipeline.dev" as contact_email_string,
  policyVersion: "2026-06-01" as policy_version_string,
  lastUpdated: "28 June 2026",
  minAgeYears: 16,
} as const

export const LEGAL_ROUTES = {
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
  accessibility: "/accessibility",
} as const

export type LegalRouteKey = keyof typeof LEGAL_ROUTES
