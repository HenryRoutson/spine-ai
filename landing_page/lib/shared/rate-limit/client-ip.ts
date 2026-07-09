// AI : client IP from proxy headers — Vercel-aware; shared by app + landing.

export function clientIpFromHeaders(headers: Headers, fallback = "unknown"): string {
  // AI : Vercel sets this — do not trust client-supplied X-Forwarded-For on production.
  if (process.env.VERCEL) {
    const vercelIp = headers.get("x-vercel-forwarded-for")?.trim()
    if (vercelIp) return vercelIp
  }
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip")?.trim() || fallback
}
