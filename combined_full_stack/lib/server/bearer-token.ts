import type { NextRequest } from "next/server";

type header_getter = { get(name: string): string | null };

export function authorizationBearerToken(source: NextRequest | header_getter): string | null {
  const auth = "headers" in source ? source.headers.get("authorization") : source.get("authorization");
  if (!auth || !/^bearer\s+/i.test(auth)) return null;
  const token = auth.replace(/^bearer\s+/i, "").trim();
  return token || null;
}
