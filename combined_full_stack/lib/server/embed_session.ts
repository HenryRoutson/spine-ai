import { createHmac, timingSafeEqual } from "node:crypto";
import {
  normalizeEmbedOrigin,
  originMatchesAllowlist,
  type embed_origin_string,
} from "@/lib/server/embed_origins";
import type { SharedLinkId } from "@/lib/server/types";

export type embed_session_token = string & { __brand: "embed_session_token" };

export const EMBED_SESSION_HEADER = "x-embed-session";

// AI : short-lived so scraped tokens from /embed HTML expire quickly.
const TOKEN_TTL_MS = 15 * 60 * 1000;

function signingSecret(): string {
  // AI : TODO security — require EMBED_SESSION_SECRET in hosted deploys; never fall through outside dev.
  return (
    process.env.EMBED_SESSION_SECRET?.trim() ||
    process.env.LANDING_BUILD_ACCESS_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "local-dev-embed-session"
  );
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function signPayload(payload: string): string {
  return b64url(createHmac("sha256", signingSecret()).update(payload).digest());
}

export function mintEmbedSessionToken(
  linkId: SharedLinkId,
  parentOrigin: embed_origin_string,
): embed_session_token {
  const exp = Date.now() + TOKEN_TTL_MS;
  // AI : | separator — origins never contain it after normalizeEmbedOrigin.
  const payload = `${linkId}|${parentOrigin}|${exp}`;
  return `${payload}.${signPayload(payload)}` as embed_session_token;
}

export function verifyEmbedSessionToken(
  linkId: SharedLinkId,
  token: string | null | undefined,
): { parentOrigin: embed_origin_string } | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const parts = payload.split("|");
  if (parts.length !== 3) return null;
  const [id, parentOriginRaw, expRaw] = parts;
  if (id !== linkId) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const parentOrigin = normalizeEmbedOrigin(parentOriginRaw ?? "");
  if (!parentOrigin || parentOrigin !== parentOriginRaw) return null;
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return { parentOrigin };
  } catch {
    return null;
  }
}

// AI : parent for mint — Referer when iframed; app origin only for same-origin / typed-URL preview.
// AI : empty Sec-Fetch-* (curl) must not mint — that was an open token faucet.
export function resolveEmbedParentOriginForMint(
  headers: Headers,
  appOrigin: string,
  allowlist: readonly string[],
): embed_origin_string | null {
  const site = (headers.get("sec-fetch-site") ?? "").toLowerCase();
  const dest = (headers.get("sec-fetch-dest") ?? "").toLowerCase();
  const mode = (headers.get("sec-fetch-mode") ?? "").toLowerCase();

  if (mode === "cors" || mode === "no-cors" || mode === "websocket") return null;
  if (dest && dest !== "document" && dest !== "iframe") return null;

  const app = normalizeEmbedOrigin(appOrigin);
  if (!app) return null;

  // AI : top-level open on our app (preview) — browsers send site=none + dest=document.
  if (site === "none" && dest === "document") return app;
  // AI : same-origin navigation / iframe of /embed from our UI.
  if (site === "same-origin" && (dest === "document" || dest === "iframe")) return app;

  // AI : cross-site iframe — require allowlisted Referer (fail closed if stripped).
  if (site === "cross-site" && dest === "iframe") {
    const referer = headers.get("referer");
    if (!referer) return null;
    let refererOrigin: embed_origin_string | null = null;
    try {
      refererOrigin = normalizeEmbedOrigin(new URL(referer).origin);
    } catch {
      return null;
    }
    if (!refererOrigin) return null;
    if (refererOrigin.toLowerCase() === app.toLowerCase()) return app;
    if (originMatchesAllowlist(refererOrigin, allowlist)) return refererOrigin;
    return null;
  }

  // AI : no Sec-Fetch → fail closed (curl/scripts are not a browser navigation).
  return null;
}

export function mintEmbedSessionForRequest(
  linkId: SharedLinkId,
  allowlist: readonly string[],
  headers: Headers,
  appOrigin: string,
): embed_session_token | null {
  const parentOrigin = resolveEmbedParentOriginForMint(headers, appOrigin, allowlist);
  if (!parentOrigin) return null;
  return mintEmbedSessionToken(linkId, parentOrigin);
}

export function embedSessionParentAllowed(
  parentOrigin: embed_origin_string,
  allowlist: readonly string[],
  appOrigin: string,
): boolean {
  const app = normalizeEmbedOrigin(appOrigin);
  if (app && parentOrigin.toLowerCase() === app.toLowerCase()) return true;
  return originMatchesAllowlist(parentOrigin, allowlist);
}

export function readEmbedSessionHeader(req: Request): string | null {
  return req.headers.get(EMBED_SESSION_HEADER)?.trim() || null;
}
