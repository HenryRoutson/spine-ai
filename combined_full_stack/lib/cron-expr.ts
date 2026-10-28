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
  { id: "daily", label: "Every day at 9:00 AM", cron: "0 9 * * *" },
  { id: "weekdays", label: "Weekdays at 9:00 AM", cron: "0 9 * * 1-5" },
  { id: "weekly", label: "Every Monday at 9:00 AM", cron: "0 9 * * 1" },
] as const

export type hour_0_23 = number
export type minute_0_59 = number
export type weekday_sun0 = number

export type ScheduleHowOftenId =
  | "every-5-min"
  | "every-10-min"
  | "every-15-min"
  | "every-30-min"
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly"

export type FriendlySchedule = {
  howOften: ScheduleHowOftenId
  hour: hour_0_23
  minute: minute_0_59
  weekday: weekday_sun0
}

export const SCHEDULE_HOW_OFTEN: { id: ScheduleHowOftenId; label: string; needsTime: boolean; needsWeekday: boolean }[] = [
  { id: "every-5-min", label: "Every 5 minutes", needsTime: false, needsWeekday: false },
  { id: "every-10-min", label: "Every 10 minutes", needsTime: false, needsWeekday: false },
  { id: "every-15-min", label: "Every 15 minutes", needsTime: false, needsWeekday: false },
  { id: "every-30-min", label: "Every 30 minutes", needsTime: false, needsWeekday: false },
  { id: "hourly", label: "Every hour", needsTime: false, needsWeekday: false },
  { id: "daily", label: "Every day", needsTime: true, needsWeekday: false },
  { id: "weekdays", label: "Weekdays (Monday–Friday)", needsTime: true, needsWeekday: false },
  { id: "weekly", label: "Once a week", needsTime: true, needsWeekday: true },
]

export const WEEKDAY_OPTIONS: { value: weekday_sun0; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
]

export const COMMON_IANA_TIMEZONES = [
  "UTC",
  "Pacific/Honolulu",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
] as const

const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

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
  // AI : 7 is Sunday on DOW; wrap in the loop so 1-7 stays Mon–Sun (wrapping end→0 made start>end).
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

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function formatClockTime(hour: hour_0_23, minute: minute_0_59): string {
  const suffix = hour < 12 ? "AM" : "PM"
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:${pad2(minute)} ${suffix}`
}

export function formatClockInput(hour: hour_0_23, minute: minute_0_59): string {
  return `${pad2(hour)}:${pad2(minute)}`
}

export function parseClockInput(value: string): { hour: hour_0_23; minute: minute_0_59 } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export function cronFromFriendlySchedule(s: FriendlySchedule): cron_expr_string {
  // AI : picker → 5-field cron; the UI never shows this string.
  const h = String(s.hour)
  const m = String(s.minute)
  const d = String(s.weekday)
  switch (s.howOften) {
    case "every-5-min":
      return "*/5 * * * *" as cron_expr_string
    case "every-10-min":
      return "*/10 * * * *" as cron_expr_string
    case "every-15-min":
      return "*/15 * * * *" as cron_expr_string
    case "every-30-min":
      return "*/30 * * * *" as cron_expr_string
    case "hourly":
      return "0 * * * *" as cron_expr_string
    case "daily":
      return `${m} ${h} * * *` as cron_expr_string
    case "weekdays":
      return `${m} ${h} * * 1-5` as cron_expr_string
    case "weekly":
      return `${m} ${h} * * ${d}` as cron_expr_string
  }
}

export function howOftenMeta(id: ScheduleHowOftenId): (typeof SCHEDULE_HOW_OFTEN)[number] {
  return SCHEDULE_HOW_OFTEN.find((row) => row.id === id) ?? SCHEDULE_HOW_OFTEN[5]!
}

function joinList(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

function describeDow(raw: string): string | null {
  if (raw === "*") return null
  if (raw === "1-5") return "Weekdays"
  if (/^\d$/.test(raw) || raw === "7") {
    const n = Number(raw) === 7 ? 0 : Number(raw)
    const name = DOW_LONG[n]
    return name ? `Every ${name}` : null
  }
  if (/^(\d+)(,\d+)+$/.test(raw)) {
    const names = raw.split(",").map((part) => {
      const n = Number(part) === 7 ? 0 : Number(part)
      return DOW_LONG[n]
    })
    if (names.every(Boolean)) return joinList(names as string[])
  }
  return null
}

function everyMinutes(raw: string): number | null {
  const star = raw.match(/^\*\/(\d+)$/)
  if (star) return Number(star[1])
  return null
}

export function describeCronExpr(expr: string): string {
  // AI : always English — never return the raw * * * * * string.
  const trimmed = expr.trim()
  if (!isValidCronExpr(trimmed)) return "Custom schedule"
  const parts = trimmed.split(/\s+/)
  const [minute, hour, dom, month, dow] = parts
  if (!minute || !hour || !dom || !month || !dow) return "Custom schedule"
  if (month !== "*") return "Custom schedule"

  const minEvery = everyMinutes(minute)
  if (minEvery != null && hour === "*" && dom === "*" && dow === "*") {
    return minEvery === 1 ? "Every minute" : `Every ${minEvery} minutes`
  }

  if (/^\d+$/.test(minute) && hour === "*" && dom === "*" && dow === "*") {
    const m = Number(minute)
    return m === 0 ? "Every hour" : `Every hour at :${pad2(m)}`
  }

  const hourEvery = everyMinutes(hour)
  if (minute === "0" && hourEvery != null && dom === "*" && dow === "*") {
    return hourEvery === 1 ? "Every hour" : `Every ${hourEvery} hours`
  }

  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return "Custom schedule"
  const clock = formatClockTime(Number(hour), Number(minute))

  if (dom === "*" && dow === "*") return `Every day at ${clock}`
  if (dom === "*" && dow === "1-5") return `Weekdays at ${clock}`
  if (dom === "*") {
    const days = describeDow(dow)
    if (days === "Weekdays") return `Weekdays at ${clock}`
    if (days?.startsWith("Every ")) return `${days} at ${clock}`
    if (days) return `${days} at ${clock}`
  }
  if (/^\d+$/.test(dom) && dow === "*") {
    return `On the ${Number(dom)} of each month at ${clock}`
  }
  return "Custom schedule"
}

export function timezoneCity(tz: string): string {
  if (tz === "UTC") return "UTC"
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ")
}

export function formatTimeZoneLabel(tz: string, now = new Date()): string {
  const city = timezoneCity(tz)
  try {
    const offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value
    return offset ? `${city} (${offset})` : city
  } catch {
    return city
  }
}

export function scheduleTimeZoneOptions(preferred: string): { value: string; label: string }[] {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = []
  const add = (tz: string, label?: string) => {
    if (seen.has(tz) || !isValidIanaTimeZone(tz)) return
    seen.add(tz)
    out.push({ value: tz, label: label ?? formatTimeZoneLabel(tz) })
  }
  if (preferred) add(preferred, `Your time — ${formatTimeZoneLabel(preferred)}`)
  for (const tz of COMMON_IANA_TIMEZONES) add(tz)
  return out
}

export function schedulePreviewSentence(cron: string, tz: string): string {
  const when = describeCronExpr(cron)
  const rest = when.charAt(0).toLowerCase() + when.slice(1)
  if (tz === "UTC") return `Runs ${rest} (UTC).`
  return `Runs ${rest}, ${timezoneCity(tz)} time.`
}
