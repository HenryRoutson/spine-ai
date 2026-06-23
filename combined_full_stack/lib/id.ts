// AI : generic so `uid<RunId>('run_')` infers branded ids in place.
export function uid<T extends string = string>(prefix = ""): T {
  const base =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return (prefix + base) as T
}
