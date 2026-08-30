import type { MetadataRoute } from "next"

// AI : prod /robots.txt was a Next 404 HTML page (proxy already skips this path).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/privacy", "/terms", "/cookies", "/accessibility", "/demo"],
        disallow: ["/api/", "/auth/"],
      },
    ],
    host: "https://www.spine-ai-app.dev",
  }
}
