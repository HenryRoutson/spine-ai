/** @type {import('next').NextConfig} */
const nextConfig = {
  // AI : pdf-parse must stay an unbundled node dep (worker files + dynamic requires).
  serverExternalPackages: ["pdf-parse"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
