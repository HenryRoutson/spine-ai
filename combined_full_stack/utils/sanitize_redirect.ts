// AI : block open redirects — only same-origin relative paths (single leading slash, no // or @).
// AI : TODO (jank-redirect-decode) — also reject percent-encoded traversal (%2e%2e), control chars, and decode once.
export function sanitizeRedirectPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.includes("@") || next.includes("\\")) return "/";
  return next;
}
