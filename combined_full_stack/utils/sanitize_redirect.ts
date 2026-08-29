// AI : block open redirects — only same-origin relative paths (single leading slash, no // or @).
// AI : DONE (jank-redirect-decode) — decode once; reject %2e%2e, control chars, leftover encoding.

function hasControlChars(path: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(path);
}

function isUnsafePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return true;
  if (path.includes("@") || path.includes("\\") || path.includes("://")) return true;
  if (hasControlChars(path)) return true;
  if (/(^|\/)\.\.(\/|$)/.test(path)) return true;
  return false;
}

export function sanitizeRedirectPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (isUnsafePath(next)) return "/";
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return "/";
  }
  if (decoded.includes("%") || isUnsafePath(decoded)) return "/";
  return decoded;
}
