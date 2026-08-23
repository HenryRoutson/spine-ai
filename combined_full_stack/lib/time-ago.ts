export function timeUntil(ts: number, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((ts - now) / 1000))
  if (sec < 60) return "in under a minute"
  const mins = Math.floor(sec / 60)
  if (mins < 60) return `in ${mins} min${mins === 1 ? "" : "s"}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs} hr${hrs === 1 ? "" : "s"}`
  const days = Math.floor(hrs / 24)
  return `in ${days} day${days === 1 ? "" : "s"}`
}

export function timeAgo(ts: number, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - ts) / 1000))
  if (sec < 10) return "just now"
  if (sec < 60) return `${sec}s ago`
  const mins = Math.floor(sec / 60)
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
  const weeks = Math.floor(days / 7)
  return `${weeks} wk${weeks === 1 ? "" : "s"} ago`
}
