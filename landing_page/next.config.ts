import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

// AI : repo-root .env — landing_page only auto-loads its own dir; parent holds shared secrets.
function loadRepoRootEnv(): void {
  const envPath = path.join(__dirname, "../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadRepoRootEnv();

const nextConfig: NextConfig = {
  // AI : repo root — shared/legal lives outside this app dir; Turbopack blocks parent imports otherwise.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // AI : baseline security headers — marketing site has no Stripe/Supabase client bootstrap.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://www.spine-ai-app.dev https://spine-ai-app.dev http://localhost:* https://localhost:*",
      "frame-src 'self' https://www.spine-ai-app.dev https://spine-ai-app.dev http://localhost:* https://localhost:*",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
