// AI : single source of truth for stripe feature flag — NEXT_PUBLIC_ is available in both
// AI : client (inlined by Next.js at build) and server (regular process.env). Default: disabled.
export const STRIPE_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";
