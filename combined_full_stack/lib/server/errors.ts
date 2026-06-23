// AI : one place for store/auth error string extraction.

export function storeErrorMessage(err: unknown, fallback = "Store unavailable"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return fallback;
}
