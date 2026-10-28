// AI : generic so `uid<RunId>('run_')` infers branded ids in place.
// AI : SECURITY — 24 hex chars (~96 bits) for unguessable public ids (landing builds, etc.).
export function uid<T extends string = string>(prefix = ""): T {
  const base =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return (prefix + base.slice(0, 24)) as T
}
