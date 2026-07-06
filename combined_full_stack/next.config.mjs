import path from "path"
import { fileURLToPath } from "url"

// AI : repo root — shared/legal lives outside this app dir; Turbopack blocks parent imports otherwise.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// AI : bridge SUPABASE_* → NEXT_PUBLIC_* so Vercel builds inline client config even when
// AI : only the non-prefixed names are set in the dashboard.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY

// AI : app root only — repo-wide root made Turbopack watch old/, landing_page/, etc.

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  env: {
    ...(supabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl } : {}),
    ...(supabaseKey ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey } : {}),
  },
  // AI : seeds/ + documents/ are read at runtime (not imported) — must ship in serverless traces.
  outputFileTracingIncludes: {
    "/api/*": ["./seeds/**/*", "./documents/**/*"],
    "/*": ["./seeds/**/*", "./documents/**/*"],
    "/api/docs": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
  // AI : pdf-parse + canvas must stay unbundled (worker files + native .node binaries).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  images: {
    unoptimized: true,
  },
  // AI : baseline security headers — CSP allows Next.js inline bootstrap + Supabase/Stripe/OpenRouter.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
    const demoFrameAncestors =
      "frame-ancestors 'self' https://spine-ai.dev https://www.spine-ai.dev http://localhost:* https://localhost:*"
    const baseSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ]
    return [
      {
        source: "/((?!demo).*)",
        headers: [
          ...baseSecurityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        source: "/demo/:path*",
        headers: [
          ...baseSecurityHeaders,
          { key: "Content-Security-Policy", value: `${csp}; ${demoFrameAncestors}` },
        ],
      },
    ]
  },
}

export default nextConfig
