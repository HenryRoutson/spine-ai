import { config as loadEnv } from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

// AI : repo root — shared/legal lives outside this app dir; Turbopack blocks parent imports otherwise.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// AI : Next.js only auto-loads .env* inside this app dir — repo-wide secrets live one level up.
loadEnv({ path: path.join(__dirname, ".env.local") })
loadEnv({ path: path.join(__dirname, "../.env") })

// AI : bridge SUPABASE_* → NEXT_PUBLIC_* so Vercel builds inline client config even when
// AI : only the non-prefixed names are set in the dashboard.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY

// AI : default off — set SESSION_REPLAY_ENABLED=true to record rrweb sessions.
const sessionReplayEnabled =
  process.env.SESSION_REPLAY_ENABLED ??
  process.env.NEXT_PUBLIC_SESSION_REPLAY_ENABLED ??
  "false"

// AI : Connect SDK talks to self-hosted Nango (API 3003, Connect UI 3009) from the Spine origin.
function nangoCspOrigins() {
  const raw = [
    process.env.NANGO_HOST,
    process.env.NANGO_PUBLIC_CONNECT_URL,
    "http://127.0.0.1:3003",
    "http://localhost:3003",
    "http://127.0.0.1:3009",
    "http://localhost:3009",
  ]
  const origins = new Set()
  const frames = new Set()
  for (const value of raw) {
    if (!value) continue
    try {
      const u = new URL(String(value))
      const http = `${u.protocol}//${u.host}`
      origins.add(http)
      origins.add(u.protocol === "https:" ? `wss://${u.host}` : `ws://${u.host}`)
      frames.add(http)
    } catch {
      // AI : ignore unparsable host — CSP must stay valid
    }
  }
  return { connect: [...origins].join(" "), frame: [...frames].join(" ") }
}
const nangoCsp = nangoCspOrigins()

// AI : app root only — repo-wide root made Turbopack watch old/, landing_page/, etc.

/** @type {import('next').NextConfig} */
const nextConfig = {
  // AI : Cursor in-app browser often uses 127.0.0.1 while `next dev` binds localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: __dirname,
  },
  env: {
    ...(supabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl } : {}),
    ...(supabaseKey ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey } : {}),
    NEXT_PUBLIC_SESSION_REPLAY_ENABLED: sessionReplayEnabled,
  },
  // AI : seeds/ + documents/ are read at runtime (not imported) — must ship in serverless traces.
  outputFileTracingIncludes: {
    "/api/*": ["./seeds/**/*", "./documents/**/*", "./lib/export_runtime/**/*"],
    "/*": ["./seeds/**/*", "./documents/**/*", "./lib/export_runtime/**/*"],
    "/api/docs": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
  // AI : pdf-parse + canvas must stay unbundled (worker files + native .node binaries).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "ink", "pg", "@electric-sql/pglite"],
  images: {
    unoptimized: true,
  },
  // AI : baseline security headers — CSP allows Next.js inline bootstrap + Supabase/Stripe/OpenRouter.
  // AI : TODO security — tighten script-src: drop global unsafe-eval; scope Pyodide/custom-code routes only.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
      "worker-src 'self' blob:",
      // AI : jsdelivr styles/fonts for TikZJax preview (tikzjax fonts.css + wasm fetch).
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://cdn.jsdelivr.net",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai https://api.stripe.com https://cdn.jsdelivr.net ${nangoCsp.connect}`.trim(),
      `frame-src 'self' https://js.stripe.com ${nangoCsp.frame}`.trim(),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
    // AI : CSP does not accept host:port wildcards — explicit localhost ports used by the landing page.
    // AI : auto-pipeline.dev still serves the same landing and iframes spine-ai-app.dev.
    const demoFrameAncestors = [
      "frame-ancestors 'self'",
      "https://spine-ai.dev",
      "https://www.spine-ai.dev",
      "https://auto-pipeline.dev",
      "https://www.auto-pipeline.dev",
      "https://www.spine-ai-app.dev",
      "https://spine-ai-app.dev",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "https://localhost:3000",
      "https://localhost:3001",
    ].join(" ")
    // AI : /embed/* framing is set per-deployment in proxy (creator allowlist) — keep global SAMEORIGIN elsewhere.
    const baseSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ]
    const demoFrameHeaders = [
      ...baseSecurityHeaders,
      { key: "Content-Security-Policy", value: `${csp}; ${demoFrameAncestors}` },
    ]
    return [
      {
        source: "/((?!demo|embed).*)",
        headers: [
          ...baseSecurityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        source: "/demo",
        headers: demoFrameHeaders,
      },
      {
        source: "/demo/:path*",
        headers: demoFrameHeaders,
      },
      {
        source: "/embed/:path*",
        headers: [
          ...baseSecurityHeaders,
          // AI : frame-ancestors appended in proxy from allowed_origins; CSP base without open framing.
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
