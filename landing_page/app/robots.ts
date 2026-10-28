import type { MetadataRoute } from "next"

// AI : prod marketing /robots.txt was a Next 404 HTML page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    host: "https://www.spine-ai.dev",
  }
}
