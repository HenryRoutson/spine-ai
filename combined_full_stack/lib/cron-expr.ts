export type cron_expr_string = string & { __brand: "cron_expr" }
export type iana_timezone_string = string & { __brand: "iana_timezone" }

export const INVALID_CRON_MESSAGE = "Cron must be 5 fields, like */15 * * * *"

const FIELD_BOUNDS = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 7 },
] as const

const DOW_NAMES: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export const CRON_PRESETS = [
  { id: "5m", label: "Every 5 minutes", cron: "*/5 * * * *" },
  { id: "15m", label: "Every 15 minutes", cron: "*/15 * * * *" },
  { id: "hourly", label: "Every hour", cron: "0 * * * *" },
  { id: "daily", label: "Every day at 09:00", cron: "0 9 * * *" },
  { id: "weekdays", label: "Weekdays at 09:00", cron: "0 9 * * 1-5" },
  { id: "weekly", label: "Every Monday at 09:00", cron: "0 9 * * 1" },
] as const

export type CronPresetId = (typeof CRON_PRESETS)[number]["id"] | "custom"

type CronField = { all: boolean; values: ReadonlySet<number> }

export function isValidIanaTimeZone(tz: string): boolean {
  if (!tz.trim() || tz.length > 64) return false
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function parseRange(raw: string, min: number, max: number, wrapDow: boolean): number[] | null {
  const [rangePart, stepRaw] = raw.split("/")
  if (!rangePart) return null
  const step = stepRaw == null ? 1 : Number(stepRaw)
  if (!Number.isInteger(step) || step < 1) return null
  let start: number
  let end: number
  if (rangePart === "*") {
    start = min
    end = max
  } else if (rangePart.includes("-")) {
    const [a, b] = rangePart.split("-")
    start = Number(a)
    end = Number(b)
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null
  } else {
    start = Number(rangePart)
    end = start
    if (!Number.isInteger(start)) return null
  }
  if (wrapDow && start === 7) start = 0
  if (wrapDow && end === 7) end = 0
  if (start < min || end > max || start > end) return null
  const out: number[] = []
  for (let n = start; n <= end; n += step) out.push(wrapDow && n === 7 ? 0 : n)
  return out
}

function parseField(raw: string, min: number, max: number, wrapDow: boolean): CronField | null {
  if (raw === "*") return { all: true, values: new Set() }
  const values = new Set<number>()
  for (const part of raw.split(",")) {
    const range = parseRange(part, min, max, wrapDow)
    if (!range) return null
    for (const n of range) values.add(n)
  }
  return { all: false, values }
}

function parseCronFields(expr: string): CronField[] | null {
  const trimmed = expr.trim()
  if (!trimmed || trimmed.length > 64) return null
  const parts = trimmed.split(/\s+/)
  if (parts.length !== 5) return null
  const fields: CronField[] = []
  for (let i = 0; i < 5; i++) {
    const bounds = FIELD_BOUNDS[i]!
    const field = parseField(parts[i]!, bounds.min, bounds.max, i === 4)
    if (!field) return null
    fields.push(field)
  }
  return fields
}

export function isValidCronExpr(expr: string): expr is cron_expr_string {
  return parseCronFields(expr) != null
}

function fieldMatches(field: CronField, value: number, wrapDow: boolean): boolean {
  if (field.all) return true
  const v = wrapDow && value === 7 ? 0 : value
  return field.values.has(v) || (wrapDow && v === 0 && field.values.has(7))
}

function matchesParts(
  fields: CronField[],
  parts: { minute: number; hour: number; day: number; month: number; dow: number },
): boolean {
  if (!fieldMatches(fields[0]!, parts.minute, false)) return false
  if (!fieldMatches(fields[1]!, parts.hour, false)) return false
  if (!fieldMatches(fields[3]!, parts.month, false)) return false
  const domAll = fields[2]!.all
  const dowAll = fields[4]!.all
  const domOk = fieldMatches(fields[2]!, parts.day, false)
  const dowOk = fieldMatches(fields[4]!, parts.dow, true)
  // AI : Vixie cron — restricted DOM and DOW OR; otherwise AND.
  if (!domAll && !dowAll) return domOk || dowOk
  return (domAll || domOk) && (dowAll || dowOk)
}

const zonedFmtCache = new Map<string, Intl.DateTimeFormat>()

function zonedFmt(timeZone: string): Intl.DateTimeFormat {
  let fmt = zonedFmtCache.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      minute: "2-digit",
      hour: "2-digit",
      day: "2-digit",
      month: "2-digit",
      weekday: "short",
      hour12: false,
    })
    zonedFmtCache.set(timeZone, fmt)
  }
  return fmt
}

function zonedParts(
  ms: number,
  timeZone: string,
): { minute: number; hour: number; day: number; month: number; dow: number } {
  const bag: Record<string, string> = {}
  for (const part of zonedFmt(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== "literal") bag[part.type] = part.value
  }
  let hour = Number(bag.hour)
  if (hour === 24) hour = 0
  return {
    minute: Number(bag.minute),
    hour,
    day: Number(bag.day),
    month: Number(bag.month),
    dow: DOW_NAMES[bag.weekday ?? "Sun"] ?? 0,
  }
}

const MAX_SCAN_MINUTES = 366 * 24 * 60

export function nextCronFireAt(expr: string, timeZone: string, fromMs = Date.now()): number | null {
  const fields = parseCronFields(expr)
  if (!fields || !isValidIanaTimeZone(timeZone)) return null
  const start = Math.floor(fromMs / 60_000) * 60_000 + 60_000
  for (let i = 0; i < MAX_SCAN_MINUTES; i++) {
    const ms = start + i * 60_000
    if (matchesParts(fields, zonedParts(ms, timeZone))) return ms
  }
  return null
}

export function cronPresetIdFor(expr: string): CronPresetId {
  const hit = CRON_PRESETS.find((p) => p.cron === expr.trim())
  return hit?.id ?? "custom"
}

export function describeCronExpr(expr: string): string {
  const hit = CRON_PRESETS.find((p) => p.cron === expr.trim())
  return hit?.label ?? expr.trim()
}
