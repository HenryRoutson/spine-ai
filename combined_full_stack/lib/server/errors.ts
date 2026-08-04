// AI : one place for store/auth error string extraction.

export function storeErrorMessage(err: unknown, fallback = "Store unavailable"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return fallback;
}

// AI : Supabase / Stripe HTTP client failures surface as TypeError: fetch failed in Node.
export function isUpstreamFetchError(err: unknown): boolean {
  const msg = storeErrorMessage(err, "");
  return (
    msg.includes("fetch failed") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENOTFOUND")
  );
}
