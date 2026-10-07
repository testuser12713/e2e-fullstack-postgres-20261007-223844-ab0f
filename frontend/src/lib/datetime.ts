// Formatting helpers for the booking UI.
//
// API timestamps arrive as ISO 8601 with a UTC offset (e.g.
// "2026-04-14T09:00:00+02:00") and are displayed in the office time zone
// (Europe/Berlin) per DESIGN.md — the raw ISO string is never shown.

export const OFFICE_TIME_ZONE = 'Europe/Berlin'

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: OFFICE_TIME_ZONE,
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/** Local calendar date of `now` as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** Move an ISO date by whole days without time-zone drift. */
export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** '2026-04-14' -> '14.04.2026'. */
export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}.${month}.${year}`
}

/** ISO date-time -> '09:30' in the office time zone. */
export function formatTime(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) return ''
  return timeFormatter.format(date)
}

/** '09:00–10:30' with an en dash. */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}\u2013${formatTime(endIso)}`
}

/** '1 h 30 min', whole hours as '2 h'. */
export function formatDuration(startIso: string, endIso: string): string {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return ''
  const totalMinutes = Math.round((endMs - startMs) / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

export function isStarted(startIso: string, now: Date): boolean {
  const startMs = Date.parse(startIso)
  return !Number.isNaN(startMs) && startMs <= now.getTime()
}

export function isInProgress(startIso: string, endIso: string, now: Date): boolean {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false
  return startMs <= now.getTime() && now.getTime() < endMs
}
