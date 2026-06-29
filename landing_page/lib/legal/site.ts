export type policy_version_string = string
export type contact_email_string = string

export const LEGAL = {
  productName: "Spine",
  controllerName: "Spine (Antler hackathon project)",
  contactEmail: "privacy@usespine.com" as contact_email_string,
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
