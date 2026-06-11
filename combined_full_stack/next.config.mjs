// AI : bridge SUPABASE_* → NEXT_PUBLIC_* so Vercel builds inline client config even when
// AI : only the non-prefixed names are set in the dashboard.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ...(supabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl } : {}),
    ...(supabaseKey ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey } : {}),
  },
  // AI : pdf-parse must stay an unbundled node dep (worker files + dynamic requires).
  serverExternalPackages: ["pdf-parse"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
