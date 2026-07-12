import type { rrweb_event_json } from "./types"

// AI : numeric rrweb enums — avoid importing @rrweb/types in shared (dashboard + apps).
const EVENT_INCREMENTAL = 3
const EVENT_META = 4
const SOURCE_MOUSE_INTERACTION = 2
const MOUSE_CLICK = 2
const MOUSE_DBL_CLICK = 4

const MAX_LABELS = 80

export function countClicksInRrwebEvents(events: rrweb_event_json[]): number {
  let n = 0
  for (const ev of events) {
    if (ev.type !== EVENT_INCREMENTAL) continue
    const data = ev.data as Record<string, unknown> | undefined
    if (!data || data.source !== SOURCE_MOUSE_INTERACTION) continue
    if (data.type === MOUSE_CLICK || data.type === MOUSE_DBL_CLICK) n += 1
  }
  return n
}

export function pagesFromRrwebMetaEvents(events: rrweb_event_json[]): string[] {
  const pages: string[] = []
  const seen = new Set<string>()
  for (const ev of events) {
    if (ev.type !== EVENT_META) continue
    const data = ev.data as { href?: string } | undefined
    const href = data?.href?.trim()
    if (!href) continue
    let path = href
    try {
      path = new URL(href).pathname || "/"
    } catch {
      // AI : keep raw href if not absolute.
    }
    if (seen.has(path)) continue
    seen.add(path)
    pages.push(path)
    if (pages.length >= MAX_LABELS) break
  }
  return pages
}

export function mergeUniqueStrings(
  existing: readonly string[],
  incoming: readonly string[],
  max = MAX_LABELS,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [...existing, ...incoming]) {
    const t = raw.trim().slice(0, 200)
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= max) break
  }
  return out
}
