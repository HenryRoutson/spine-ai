import { isPublicApiPath } from "@/lib/api-routes"
import { authorizationBearerToken } from "@/lib/server/bearer-token"

type header_getter = { get(name: string): string | null }

// AI : Edge middleware 401s cookie-less APIs before requireAuth() can read Bearer.
// AI : MCP/CLI send SPINE_API_TOKEN as Authorization: Bearer — let those through.
export function middlewareBlocksCookielessApi(
  pathname: string,
  method: string,
  headers: header_getter,
): boolean {
  if (!pathname.startsWith("/api/")) return false
  if (isPublicApiPath(pathname, method)) return false
  if (authorizationBearerToken(headers)) return false
  return true
}
