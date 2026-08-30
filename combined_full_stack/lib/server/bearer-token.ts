import type { NextRequest } from "next/server";

type header_getter = { get(name: string): string | null };

function authorizationHeader(source: NextRequest | header_getter): string | null {
  // AI : NextRequest has url + headers; Web Headers / next/headers() only have get().
  if ("url" in source) return source.headers.get("authorization");
  return source.get("authorization");
}

export function authorizationBearerToken(source: NextRequest | header_getter): string | null {
  const auth = authorizationHeader(source);
  if (!auth || !/^bearer\s+/i.test(auth)) return null;
  const token = auth.replace(/^bearer\s+/i, "").trim();
  return token || null;
}
