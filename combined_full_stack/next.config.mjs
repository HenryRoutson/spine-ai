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
}

export default nextConfig
