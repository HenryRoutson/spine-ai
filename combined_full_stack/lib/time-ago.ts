function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`
}

function formatDelta(sec: number, direction: "past" | "future"): string {
  if (direction === "future") {
    if (sec < 60) return "in under a minute"
    const mins = Math.floor(sec / 60)
    if (mins < 60) return `in ${plural(mins, "min")}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `in ${plural(hrs, "hr")}`
    return `in ${plural(Math.floor(hrs / 24), "day")}`
  }
  if (sec < 10) return "just now"
  if (sec < 60) return `${sec}s ago`
  const mins = Math.floor(sec / 60)
  if (mins < 60) return `${plural(mins, "min")} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${plural(hrs, "hr")} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${plural(days, "day")} ago`
  return `${plural(Math.floor(days / 7), "wk")} ago`
}

export function timeUntil(ts: number, now = Date.now()): string {
  return formatDelta(Math.max(0, Math.floor((ts - now) / 1000)), "future")
}

export function timeAgo(ts: number, now = Date.now()): string {
  return formatDelta(Math.max(0, Math.floor((now - ts) / 1000)), "past")
}
